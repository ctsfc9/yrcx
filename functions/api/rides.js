export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PASSWORD = "admin888"; // 管理员密码

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  
  // --- 1. 获取系统配置 (GET) ---
  if (request.method === "GET" && action === 'get_config') {
    try {
      const { results } = await db.prepare("SELECT * FROM system_config").all();
      const config = {};
      results.forEach(item => { config[item.key] = item.value; });
      return Response.json(config);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // --- 2. 更新系统配置 (POST - 管理员) ---
  if (request.method === "POST" && action === 'update_config') {
    try {
      const body = await request.json();
      if (body.admin_key !== ADMIN_PASSWORD) return Response.json({ error: "密码错误" }, { status: 403 });
      
      const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      await db.batch([
        stmt.bind('publish_fee', String(body.publish_fee)),
        stmt.bind('top_fee', String(body.top_fee)),
        stmt.bind('notice_text', body.notice_text)
      ]);
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // --- 原有逻辑保持 ---
  const adminKey = url.searchParams.get("admin_key");
  const isAdmin = (adminKey === ADMIN_PASSWORD);

  // 封禁检测
  const checkBan = async (userId) => {
    if (!userId) return false;
    const banned = await db.prepare("SELECT * FROM blacklist WHERE user_id = ?").bind(userId).first();
    return !!banned;
  };

  // GET 请求 (获取列表)
  if (request.method === "GET") {
    if (action === 'check_status') {
      const checkUserId = url.searchParams.get("user_id");
      return Response.json({ isBanned: await checkBan(checkUserId) });
    }

    const filterUserId = url.searchParams.get("filter_user_id");
    const type = url.searchParams.get("type");
    let sql = "SELECT * FROM rides";
    const params = [];
    const conditions = [];

    if (filterUserId) {
      conditions.push("user_id = ?");
      params.push(filterUserId);
    } else if (!isAdmin) {
      if (type && type !== 'all') {
        conditions.push("type = ?");
        params.push(type);
      }
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY is_top DESC, id DESC LIMIT " + (isAdmin ? "200" : "50");

    try {
      const { results } = await db.prepare(sql).bind(...params).all();
      return Response.json({ results });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // POST 请求 (发布/修改/封禁)
  if (request.method === "POST") {
    try {
      const body = await request.json();

      if (isAdmin) {
        if (body.action === 'ban') {
          await db.prepare("INSERT OR IGNORE INTO blacklist (user_id, reason) VALUES (?, ?)").bind(body.target_id, '违规').run();
          await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(body.target_id).run();
          return Response.json({ success: true, msg: '已拉黑' });
        }
        if (body.action === 'update') {
          // 管理员修改 (增加了 car_model)
          await db.prepare(
            `UPDATE rides SET origin=?, destination=?, date=?, seats=?, price=?, remark=?, contact=?, car_model=? WHERE id=?`
          ).bind(body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.car_model || '', body.id).run();
          return Response.json({ success: true, msg: '修改成功' });
        }
      }

      // 发布操作
      if (await checkBan(body.user_id)) return Response.json({ error: "账号被封禁" }, { status: 403 });
      if (!body.origin || !body.destination || !body.contact) return Response.json({ error: "信息不完整" }, { status: 400 });

      // 插入数据 (增加了 car_model)
      const result = await db.prepare(
        `INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, pay_amount, is_top, car_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(body.user_id, body.type, body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.pay_amount || 0, body.is_top || 0, body.car_model || '').run();

      return Response.json({ success: true, meta: result });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // DELETE 请求
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    const userId = url.searchParams.get("user_id");
    try {
      if (isAdmin) await db.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
      else if (userId) await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
      else return Response.json({ error: "无权操作" }, { status: 403 });
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
