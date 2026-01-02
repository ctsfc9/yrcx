export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  
  // --- 管理员密码配置 (上线后请修改这里) ---
  const ADMIN_PASSWORD = "admin888"; 
  // ------------------------------------

  const url = new URL(request.url);

  // 1. GET 请求: 获取拼车列表
  if (request.method === "GET") {
    const type = url.searchParams.get("type"); // driver 或 passenger
    const adminKey = url.searchParams.get("admin_key");
    const isAdmin = (adminKey === ADMIN_PASSWORD);

    let sql = "SELECT * FROM rides";
    const params = [];

    // 如果不是管理员，且有筛选条件 (all 时不加 where)
    if (!isAdmin) {
      if (type && type !== 'all') {
        sql += " WHERE type = ?";
        params.push(type);
      }
    }
    
    // 排序：最新的在最前面
    // 限制：管理员看最新的200条，普通用户看50条
    sql += " ORDER BY id DESC LIMIT " + (isAdmin ? "200" : "50");

    try {
      const { results } = await db.prepare(sql).bind(...params).all();
      return Response.json({ results });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 2. POST 请求: 发布新行程
  if (request.method === "POST") {
    try {
      const body = await request.json();
      
      // 必填项简单校验
      if (!body.origin || !body.destination || !body.contact) {
        return Response.json({ error: "出发地、目的地、电话不能为空" }, { status: 400 });
      }

      const result = await db.prepare(
        `INSERT INTO rides (type, origin, destination, date, seats, price, remark, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(body.type, body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact).run();

      return Response.json({ success: true, meta: result });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // 3. DELETE 请求: 删除行程 (仅限管理员)
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    const key = url.searchParams.get("admin_key");

    // 鉴权
    if (key !== ADMIN_PASSWORD) {
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
