export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB; // 注意：Cloudflare Pages 绑定的 D1 变量名必须叫 DB

  if (request.method === 'GET') {
    const { results } = await db.prepare("SELECT * FROM rides ORDER BY created_at DESC LIMIT 100").all();
    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'POST') {
    const data = await request.json();
    if (!data.user_id || !data.origin) return new Response(JSON.stringify({ error: '缺少关键参数' }), { status: 400 });
    
    // 检查是否绑定手机号 (防 403)
    const user = await db.prepare("SELECT phone FROM users WHERE id = ?").bind(data.user_id).first();
    if (!user || !user.phone) return new Response(JSON.stringify({ error: '请先绑定手机号' }), { status: 403 });

    await db.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, car_model, remark, contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.car_model, data.remark, data.contact).run();
    return new Response(JSON.stringify({ success: true }));
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');
    await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
    return new Response(JSON.stringify({ success: true }));
  }
}
