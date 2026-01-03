export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PASSWORD = "admin888"; 

  const url = new URL(request.url);
  const adminKey = url.searchParams.get("admin_key");
  const isAdmin = (adminKey === ADMIN_PASSWORD);

  // ==========================================
  // 1. 封禁检测中间件 (检查当前用户是否被封)
  // ==========================================
  const checkBan = async (userId) => {
    if (!userId) return false;
    const banned = await db.prepare("SELECT * FROM blacklist WHERE user_id = ?").bind(userId).first();
    return !!banned;
  };

  // ==========================================
  // 2. GET 请求: 获取列表 / 检查封禁状态
  // ==========================================
  if (request.method === "GET") {
    const action = url.searchParams.get("action");
    const checkUserId = url.searchParams.get("user_id");

    // 2.1 专门用于前端检查用户是否被封
    if (action === 'check_status') {
      const isBanned = await checkBan(checkUserId);
      return Response.json({ isBanned });
    }

    // 2.2 获取列表
    const type = url.searchParams.get("type");
    let sql = "SELECT * FROM rides";
    const params = [];

    if (!isAdmin) {
      // 普通用户只能看未被封禁的帖子 (这里简化处理，暂不联表查询，仅筛选类型)
      if (type && type !== 'all') {
        sql += " WHERE type = ?";
        params.push(type);
      }
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

  // ==========================================
  // 3. POST 请求: 发布 / 管理员操作
  // ==========================================
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // --- 管理员操作区 ---
      if (isAdmin) {
        // 3.1 管理员修改信息
        if (body.action === 'update') {
          await db.prepare(
            `UPDATE rides SET origin=?, destination=?, date=?, seats=?, price=?, remark=?, contact=? WHERE id=?`
          ).bind(body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.id).run();
          return Response.json({ success: true, msg: '修改成功' });
        }
        
        // 3.2 管理员拉黑用户
        if (body.action === 'ban') {
          await db.prepare("INSERT OR IGNORE INTO blacklist (user_id, reason) VALUES (?, ?)").bind(body.target_id, '违规').run();
          // 可选：拉黑后删除该用户所有帖子
          await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(body.target_id).run();
          return Response.json({ success: true, msg: '已拉黑并清空其帖子' });
        }

        // 3.3 管理员解禁用户
        if (body.action === 'unban') {
          await db.prepare("DELETE FROM blacklist WHERE user_id = ?").bind(body.target_id).run();
          return Response.json({ success: true, msg: '已解禁' });
        }
      }

      // --- 普通用户发布 ---
      
      // 先查封禁
      if (await checkBan(body.user_id)) {
        return Response.json({ error: "您的账号已被封禁，无法发布" }, { status: 403 });
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

  // ==========================================
  // 4. DELETE 请求: 删除行程
  // ==========================================
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    
    if (!isAdmin) {
      return Response.json({ error: "无权操作" }, { status: 403 });
    }

    try {
      await db.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
