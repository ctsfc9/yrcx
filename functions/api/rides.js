export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 获取列表 (GET) - ★ 修改排序逻辑 ★
  if (request.method === "GET") {
    try {
      const type = url.searchParams.get("type");
      
      // ORDER BY date ASC: 按出发时间 正序排列 (最近出发的在最前面)
      // WHERE date >= datetime('now', '-1 day'): 可选，过滤掉太久以前的(比如昨天之前的)，保持列表新鲜
      // 这里暂时只改排序，不强制过滤，以免时区问题导致刚发的不显示
      
      let query = "SELECT * FROM rides ORDER BY date ASC LIMIT 50";
      
      if (type && type !== 'all') {
        query = `SELECT * FROM rides WHERE type = '${type}' ORDER BY date ASC LIMIT 50`;
      }
      
      const { results } = await env.DB.prepare(query).all();
      return Response.json({ results: results || [] });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 2. 发布拼车 (POST) - 保持不变
  if (request.method === "POST") {
    try {
      const data = await request.json();
      const stmt = env.DB.prepare(`
        INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      await stmt.bind(
        data.user_id, data.type, data.origin, data.destination, 
        data.date, data.seats, data.price, data.remark, 
        data.contact, data.car_model
      ).run();
      
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 3. 删除 (DELETE) - 保持不变
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    await env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
