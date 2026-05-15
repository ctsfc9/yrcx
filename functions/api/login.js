export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'POST') {
    const data = await request.json();
    const userId = data.id || 'user_' + Date.now(); // 简易生成ID
    
    // 插入或更新用户信息
    await env.DB.prepare(`
      INSERT INTO users (id, nickname, phone, avatar) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname, phone=excluded.phone
    `).bind(userId, data.nickname, data.phone, data.avatar).run();
    
    return new Response(JSON.stringify({ success: true, userId }), { headers: { 'Content-Type': 'application/json' } });
  }
}
