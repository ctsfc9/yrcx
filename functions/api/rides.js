// 行程记录核心接口：增加头像昵称联查与修改编辑功能
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      // 联表查询：获取该行程及其发布人的真实头像、昵称
      const ride = await db.prepare("SELECT r.*, u.nickname as publisher_nickname, u.avatar as publisher_avatar FROM rides r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?").bind(id).first();
      if (!ride) return new Response(JSON.stringify({ error: '行程不存在或已被删除' }), { status: 404 });
      return new Response(JSON.stringify(ride), { headers: { 'Content-Type': 'application/json' } });
    } else {
      // 联表查询：获取全部行程给首页和后台展示
      const { results } = await db.prepare(`
        SELECT r.*, u.nickname as publisher_nickname, u.avatar as publisher_avatar 
        FROM rides r 
        LEFT JOIN users u ON r.user_id = u.id 
        ORDER BY r.is_top DESC, r.id DESC LIMIT 200
      `).all();
      return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (request.method === 'POST') {
    try {
      const data = await request.json();
      if (!data.user_id || !data.origin) return new Response(JSON.stringify({ error: '核心参数缺失' }), { status: 400 });

      // 如果传入了 id，说明是用户在“重新编辑”该行程
      if (data.id) {
         await db.prepare("UPDATE rides SET type=?, origin=?, destination=?, date=?, seats=?, price=?, car_model=?, remark=?, contact=? WHERE id=? AND user_id=?")
           .bind(data.type, data.origin, data.destination, data.date, data.seats, data.price, data.car_model, data.remark, data.contact, data.id, data.user_id).run();
         return new Response(JSON.stringify({ success: true, ride_id: data.id }));
      } else {
         // 新发布行程
         const runResult = await db.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, car_model, remark, contact, is_top) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
           .bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.car_model, data.remark, data.contact).run();
         return new Response(JSON.stringify({ success: true, ride_id: runResult.meta.last_row_id }));
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');
    const isAdmin = url.searchParams.get('admin');

    if (isAdmin === 'true') {
        await db.prepare("DELETE FROM rides WHERE id = ?").bind(id).run();
    } else {
        await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
    }
    return new Response(JSON.stringify({ success: true }));
  }
}
