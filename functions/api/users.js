// 后台用户管理接口：支持拉黑与彻底删除
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  try { await db.prepare("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0").run(); } catch(e) {}

  if (request.method === 'GET') {
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
      if (data.is_banned === 1) {
        await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(data.id).run();
      }
      return new Response(JSON.stringify({ success: true }));
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // 🚀 新增：彻底删除用户及名下所有行程
  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (id) {
      await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(id).run();
      return new Response(JSON.stringify({ success: true }));
    }
  }

  return new Response('Not Found', { status: 404 });
}
