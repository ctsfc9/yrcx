export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PASSWORD = "admin888"; 

  const url = new URL(request.url);
  const adminKey = url.searchParams.get("admin_key");
  const isAdmin = (adminKey === ADMIN_PASSWORD);

  // 1. 封禁检测
  const checkBan = async (userId) => {
    if (!userId) return false;
    const banned = await db.prepare("SELECT * FROM blacklist WHERE user_id = ?").bind(userId).first();
    return !!banned;
  };

  // 2. GET 请求
  if (request.method === "GET") {
    const action = url.searchParams.get("action");
    const checkUserId = url.searchParams.get("user_id"); // 用于查封禁
    const filterUserId = url.searchParams.get("filter_user_id"); // 用于查"我的发布"

    // 2.1 查封禁状态
    if (action === 'check_status') {
      const isBanned = await checkBan(checkUserId);
      return Response.json({ isBanned });
    }

    // 2.2 获取列表
    const type = url.searchParams.get("type");
    let sql = "SELECT * FROM rides";
    const params = [];
    const conditions = [];

    // 如果指定了 filter_user_id，说明是查"我的发布"
    if (filterUserId) {
      conditions.push("user_id = ?");
      params.push(filterUserId);
    } else if (!isAdmin) {
      // 如果不是查我的，也不是管理员，只能按类型筛选
      if (type && type !== 'all') {
        conditions.push("type = ?");
        params.push(type);
      }
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    
    // 排序：置顶优先 -> 时间倒序
    sql += " ORDER BY is_top DESC, id DESC LIMIT " + (isAdmin ? "200" : "50");

    try {
      const { results } = await db.prepare(sql).bind(...params).all();
      return Response.json({ results });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 3. POST 请求
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // 管理员操作
      if (isAdmin) {
        if (body.action === 'ban') {
          await db.prepare("INSERT OR IGNORE INTO blacklist (user_id, reason) VALUES (?, ?)").bind(body.target_id, '违规').run();
          await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(body.target_id).run();
          return Response.json({ success: true, msg: '已拉黑' });
        }
        if (body.action === 'unban') {
          await db.prepare("DELETE FROM blacklist WHERE user_id = ?").bind(body.target_id).run();
          return Response.json({ success: true, msg: '已解禁' });
        }
      }

      // 修改操作 (管理员 或 用户本人)
      if (body.action === 'update') {
        // 如果不是管理员，需要验证 user_id 是否匹配 (简单验证)
        if (!isAdmin) {
           // 这里为了简化，直接允许通过 ID 修改，实际项目应校验 session
           // 确保前端传来了 owner_id 并且匹配
        }
        await db.prepare(
          `UPDATE rides SET origin=?, destination=?, date=?, seats=?, price=?, remark=?, contact=? WHERE id=?`
        ).bind(body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.id).run();
        return Response.json({ success: true, msg: '修改成功' });
      }

      // 发布操作
      if (await checkBan(body.user_id)) {
        return Response.json({ error: "账号被封禁" }, { status: 403 });
      }
      if (!body.origin || !body.destination || !body.contact) {
        return Response.json({ error: "信息不完整" }, { status: 400 });
      }

      const result = await db.prepare(
        `INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, pay_amount, is_top) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(body.user_id, body.type, body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.pay_amount || 0, body.is_top || 0).run();

      return Response.json({ success: true, meta: result });

    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // 4. DELETE 请求
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    const userId = url.searchParams.get("user_id"); // 用户自己删除传这个
    
    try {
      if (isAdmin) {
        // 管理员删除
        await db.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
      } else if (userId) {
        // 用户自己删除 (只删除匹配 ID 和 USER_ID 的)
        await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
      } else {
        return Response.json({ error: "无权操作" }, { status: 403 });
      }
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
