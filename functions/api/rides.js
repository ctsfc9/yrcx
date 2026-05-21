// 行程记录核心接口：带被删用户拦截
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const ride = await db.prepare("SELECT r.*, u.nickname as publisher_nickname, u.avatar as publisher_avatar FROM rides r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = ?").bind(id).first();
      if (!ride) return new Response(JSON.stringify({ error: '行程不存在或已被删除' }), { status: 404 });
      return new Response(JSON.stringify(ride), { headers: { 'Content-Type': 'application/json' } });
    } else {
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
      if (!data.user_id || !data.origin) return new Response(JSON.stringify({ error: '参数缺失' }), { status: 400 });

      // 🌟 核心修复：查验发布人是否已被后台管理员删除
      const user = await db.prepare("SELECT phone, balance FROM users WHERE id = ?").bind(data.user_id).first();
      if (!user) {
          // 如果已被删除，抛出 401 状态码，通知前端强制退出重登
          return new Response(JSON.stringify({ error: 'USER_DELETED' }), { status: 401 });
      }

      if (data.old_id) {
          await db.prepare("UPDATE rides SET type=?, origin=?, destination=?, date=?, seats=?, price=?, car_model=?, remark=?, contact=? WHERE id=? AND user_id=?")
           .bind(data.type, data.origin, data.destination, data.date, data.seats, data.price, data.car_model, data.remark, data.contact, data.old_id, data.user_id).run();
          return new Response(JSON.stringify({ success: true, ride_id: data.old_id }));
      }

      if (!user.phone) return new Response(JSON.stringify({ error: '请先绑定手机' }), { status: 403 });

      const config = await db.prepare("SELECT publish_fee FROM system_config LIMIT 1").first();
      const fee = config?.publish_fee ? parseFloat(config.publish_fee) : 0;

      if (fee > 0 && !data.old_id) { 
        if (parseFloat(user.balance || 0) < fee) {
          return new Response(JSON.stringify({ error: '余额不足', fee: fee }), { status: 402, headers: {'Content-Type':'application/json'} });
        }
        const orderId = 'ORD_PUB_' + Date.now();
        await db.batch([
           db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").bind(fee, data.user_id),
           db.prepare("INSERT INTO orders (id, user_id, amount, type, status) VALUES (?, ?, ?, ?, ?)").bind(orderId, data.user_id, fee, 'publish', 'success')
        ]);
      }

      const runResult = await db.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, car_model, remark, contact, is_top) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.car_model, data.remark, data.contact, data.is_top || 0).run();
      
      return new Response(JSON.stringify({ success: true, ride_id: runResult.meta.last_row_id }));
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
