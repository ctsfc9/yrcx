// 后台用户管理与封禁处理接口
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    // 联合查询用户表和行程表，确保获取最新头像、昵称和绑定的手机号
    try {
      const { results } = await db.prepare(`
        SELECT u.id, u.nickname, u.avatar, u.balance, u.is_banned,
        (SELECT r.contact FROM rides r WHERE r.user_id = u.id ORDER BY r.id DESC LIMIT 1) as phone
        FROM users u ORDER BY u.id DESC
      `).all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (request.method === 'POST' && url.pathname.endsWith('/ban')) {
    try {
      const data = await request.json();
      await db.prepare("UPDATE users SET is_banned = ? WHERE id = ?").bind(data.is_banned, data.id).run();
      
      // 联动：如果用户被封禁，立即清除该用户发布的所有拼车行程
      if (data.is_banned === 1) {
        await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(data.id).run();
      }
      return new Response(JSON.stringify({ success: true }));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
}
