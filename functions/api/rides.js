export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PASSWORD = "admin888"; 

  const url = new URL(request.url);
  const adminKey = url.searchParams.get("admin_key");
  const isAdmin = (adminKey === ADMIN_PASSWORD);
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

  // --- 2. 更新系统配置 (POST) ---
  if (request.method === "POST" && action === 'update_config') {
    try {
      const body = await request.json();
      if (body.admin_key !== ADMIN_PASSWORD) return Response.json({ error: "密码错误" }, { status: 403 });
      
      const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      const batch = [];
      // 动态保存所有传入的配置
      for (const [key, val] of Object.entries(body.config)) {
        batch.push(stmt.bind(key, String(val)));
      }
      await db.batch(batch);
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // --- 3. 核心业务逻辑 ---

  const checkBan = async (userId) => {
    if (!userId) return false;
    const banned = await db.prepare("SELECT * FROM blacklist WHERE user_id = ?").bind(userId).first();
    return !!banned;
  };

  // GET: 获取列表
  if (request.method === "GET") {
    if (action === 'check_status') {
      const checkUserId = url.searchParams.get("user_id");
      return Response.json({ isBanned: await checkBan(checkUserId) });
    }

    const filterUserId = url.searchParams.get("filter_user_id");
    const type = url.searchParams.get("type");
    
    // 获取"是否显示过期"的配置
    let showExpired = true;
    try {
      const configRow = await db.prepare("SELECT value FROM system_config WHERE key = 'show_expired'").first();
      showExpired = configRow && configRow.value === 'true';
    } catch(e) {}

    let sql = "SELECT * FROM rides";
    const params = [];
    const conditions = [];

    // 筛选用户
    if (filterUserId) {
      conditions.push("user_id = ?");
      params.push(filterUserId);
    } else {
      // 首页逻辑：如果不显示过期，且不是管理员，则过滤时间
      if (!isAdmin && !showExpired) {
        // SQLite datetime('now') 获取当前 UTC 时间，注意你的入库时间格式是否带时区
        // 简单处理：我们入库是 ISO 格式 YYYY-MM-DDTHH:MM，比较字符串即可
        // 为了准确，这里用 SQLite 的 datetime 函数
        conditions.push("date >= datetime('now', '+8 hours')"); 
      }
      if (!isAdmin && type && type !== 'all') {
        conditions.push("type = ?");
        params.push(type);
      }
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    
    // 排序优化：置顶优先 -> 出发时间由近到远 (ASC)
    // 之前的 id DESC 是发布时间倒序，现在改用 date ASC (即将出发在前)
    if (filterUserId) {
        // 个人中心还是看发布时间比较好
        sql += " ORDER BY id DESC LIMIT 50";
    } else {
        // 首页看出发时间
        sql += " ORDER BY is_top DESC, date ASC LIMIT " + (isAdmin ? "200" : "50");
    }

    try {
      const { results } = await db.prepare(sql).bind(...params).all();
      return Response.json({ results });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // POST: 发布/修改/封禁
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // 管理员操作
      if (isAdmin) {
        if (body.action === 'ban') {
          await db.prepare("INSERT OR IGNORE INTO blacklist (user_id, reason) VALUES (?, ?)").bind(body.target_id, '违规').run();
          await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(body.target_id).run();
          return Response.json({ success: true });
        }
        if (body.action === 'update') {
          await db.prepare(
            `UPDATE rides SET origin=?, destination=?, date=?, seats=?, price=?, remark=?, contact=?, car_model=? WHERE id=?`
          ).bind(body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.car_model || '', body.id).run();
          return Response.json({ success: true });
        }
      }

      // 普通发布
      if (await checkBan(body.user_id)) return Response.json({ error: "账号被封禁" }, { status: 403 });
      
      const result = await db.prepare(
        `INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, pay_amount, is_top, car_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(body.user_id, body.type, body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.pay_amount || 0, body.is_top || 0, body.car_model || '').run();

      return Response.json({ success: true, meta: result });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // DELETE
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    const userId = url.searchParams.get("user_id");
    try {
      if (isAdmin) await db.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
      else if (userId) await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
      else return Response.json({ error: "无权" }, { status: 403 });
      return Response.json({ success: true });
    } catch (err) { return Response.json({ error: err.message }, { status: 500 }); }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
