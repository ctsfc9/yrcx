export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 获取列表 (GET) - ★ 修改排序逻辑 ★
  if (request.method === "GET") {
    try {
      const type = url.searchParams.get("type");
      const isAdmin = url.searchParams.get("admin") === 'true';
      
      let query = "SELECT * FROM rides WHERE user_id NOT IN (SELECT user_id FROM blacklist) ORDER BY date ASC LIMIT 50";
      if (isAdmin) {
        query = "SELECT * FROM rides ORDER BY date DESC LIMIT 100";
      }
      
      if (type && type !== 'all') {
        if (isAdmin) {
          query = `SELECT * FROM rides WHERE type = '${type}' ORDER BY date DESC LIMIT 100`;
        } else {
          query = `SELECT * FROM rides WHERE type = '${type}' AND user_id NOT IN (SELECT user_id FROM blacklist) ORDER BY date ASC LIMIT 50`;
        }
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
    const userId = url.searchParams.get("user_id");
    
    if (userId) {
      // 仅限发布者本人删除
      await env.DB.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
    } else {
      // 管理员删除 (没有传 user_id)
      await env.DB.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
    }
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
