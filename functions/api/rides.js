export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // POST: 发布行程
  if (request.method === "POST") {
    try {
      const body = await request.json();
      // 简单校验
      if (!body.type || !body.origin || !body.destination || !body.contact) {
        return Response.json({ error: "关键信息不能为空" }, { status: 400 });
      }

      const result = await db.prepare(
        `INSERT INTO rides (type, origin, destination, date, seats, price, remark, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(body.type, body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact).run();

      return Response.json({ success: true, meta: result });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  // GET: 获取列表 (支持按 type 筛选)
  if (request.method === "GET") {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // 从 URL 获取筛选参数

    let sql = "SELECT * FROM rides";
    const params = [];

    if (type && type !== 'all') {
      sql += " WHERE type = ?";
      params.push(type);
    }
    
    sql += " ORDER BY id DESC LIMIT 50"; // 增加数量限制到50条，符合信息门户习惯

    const { results } = await db.prepare(sql).bind(...params).all();
    return Response.json({ results });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
