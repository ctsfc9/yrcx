export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 1. 获取行程 (修复：支持单条详情查询 & 按置顶、时间排序)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      // 详情页查询
      const ride = await db.prepare("SELECT * FROM rides WHERE id = ?").bind(id).first();
      if (!ride) return new Response(JSON.stringify({ error: '行程不存在或已被删除' }), { status: 404 });
      return new Response(JSON.stringify(ride), { headers: { 'Content-Type': 'application/json' } });
    } else {
      // 首页列表查询 (置顶优先，再按出发时间升序)
      const { results } = await db.prepare("SELECT * FROM rides ORDER BY is_top DESC, date ASC LIMIT 200").all();
      return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // 2. 发布行程 (保留全部扣费逻辑)
  if (request.method === 'POST') {
    try {
      const data = await request.json();
      if (!data.user_id || !data.origin) return new Response(JSON.stringify({ error: '参数缺失' }), { status: 400 });

      const user = await db.prepare("SELECT phone, balance FROM users WHERE id = ?").bind(data.user_id).first();
      if (!user || !user.phone) return new Response(JSON.stringify({ error: '请先绑定手机' }), { status: 403 });

      const config = await db.prepare("SELECT publish_fee FROM system_config LIMIT 1").first();
      const fee = config?.publish_fee ? parseFloat(config.publish_fee) : 0;

      if (fee > 0) {
        if (parseFloat(user.balance || 0) < fee) {
          return new Response(JSON.stringify({ error: '余额不足', fee: fee }), { status: 402, headers: {'Content-Type':'application/json'} });
        }
        const orderId = 'ORD_PUB_' + Date.now();
        await db.batch([
           db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").bind(fee, data.user_id),
           db.prepare("INSERT INTO orders (id, user_id, amount, type, status) VALUES (?, ?, ?, ?, ?)").bind(orderId, data.user_id, fee, 'publish', 'success')
        ]);
      }

      await db.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, car_model, remark, contact, is_top) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.car_model, data.remark, data.contact, data.is_top || 0).run();
      return new Response(JSON.stringify({ success: true }));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(url.searchParams.get('id'), url.searchParams.get('user_id')).run();
    return new Response(JSON.stringify({ success: true }));
  }
}
