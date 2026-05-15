export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 1. 获取行程列表
  if (request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || 100;
    
    const { results } = await db.prepare("SELECT * FROM rides ORDER BY created_at DESC LIMIT ?").bind(limit).all();
    return new Response(JSON.stringify({ results }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // 2. 发布行程 (包含收费与余额扣款逻辑)
  if (request.method === 'POST') {
    try {
      const data = await request.json();
      
      if (!data.user_id || !data.origin) {
        return new Response(JSON.stringify({ error: '缺少关键参数' }), { status: 400 });
      }

      // 【安全卡口 1】检查用户是否存在并已绑定手机号
      const user = await db.prepare("SELECT phone, balance FROM users WHERE id = ?").bind(data.user_id).first();
      if (!user || !user.phone) {
        return new Response(JSON.stringify({ error: '请先绑定手机号' }), { status: 403 });
      }

      // 【安全卡口 2】收费逻辑校验
      const config = await db.prepare("SELECT publish_fee FROM system_config LIMIT 1").first();
      const fee = config?.publish_fee ? parseFloat(config.publish_fee) : 0;
      const currentBalance = parseFloat(user.balance || 0);

      if (fee > 0) {
        // 如果余额不够扣发布费
        if (currentBalance < fee) {
           return new Response(JSON.stringify({ 
               error: `余额不足，发布需扣除 ${fee} 元，当前余额 ${currentBalance} 元`, 
               need_recharge: true, 
               fee: fee 
           }), { status: 402, headers: { 'Content-Type': 'application/json' } });
        }

        // 余额充足，生成流水号
        const orderId = 'ORD_PUB_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        
        // 使用 D1 的 Batch (批量事务) 确保扣款和流水同时成功，绝不出现“乱扣钱”现象
        await db.batch([
           db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").bind(fee, data.user_id),
           db.prepare("INSERT INTO orders (id, user_id, amount, type, status) VALUES (?, ?, ?, ?, ?)").bind(orderId, data.user_id, fee, 'publish', 'success')
        ]);
      }

      // 【执行动作】扣款通过（或免费），正式写入行程信息
      await db.prepare(`
        INSERT INTO rides (user_id, type, origin, destination, date, seats, price, car_model, remark, contact) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        data.user_id, data.type, data.origin, data.destination, data.date, 
        data.seats, data.price, data.car_model, data.remark, data.contact
      ).run();

      return new Response(JSON.stringify({ success: true, deducted: fee }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
      
    } catch (e) {
      return new Response(JSON.stringify({ error: '服务器内部错误: ' + e.message }), { 
        status: 500, headers: { 'Content-Type': 'application/json' } 
      });
    }
  }

  // 3. 删除自己的行程
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const userId = url.searchParams.get('user_id');
    
    await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, userId).run();
    return new Response(JSON.stringify({ success: true }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
