export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PWD = env.ADMIN_PWD || "admin888"; 
  const SYS_USER = env.ADMIN_USER || "admin";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 登录
  if (request.method === "POST" && action === 'login') {
    const body = await request.json();
    if (body.username === SYS_USER && body.password === ADMIN_PWD) {
      return Response.json({ success: true, token: ADMIN_PWD });
    }
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  // 鉴权 helper
  const token = url.searchParams.get("token"); 
  const verifyBody = async () => {
    try { const b = await request.clone().json(); return b.auth_token === ADMIN_PWD; } catch { return false; }
  };

  // 获取数据 (拼车/用户)
  if (request.method === "GET") {
    if (!token || token !== ADMIN_PWD) return Response.json({ error: "无权" }, { status: 403 });
    
    if (action === 'get_rides') {
      const { results } = await db.prepare("SELECT * FROM rides ORDER BY id DESC LIMIT 100").all();
      return Response.json({ list: results || [] });
    }
    if (action === 'get_users') {
      // 聚合查询用户发帖数
      const { results } = await db.prepare("SELECT user_id, COUNT(*) as post_count FROM rides GROUP BY user_id ORDER BY post_count DESC LIMIT 100").all();
      const users = results || [];
      // 检查封禁状态
      for(let u of users) {
        const ban = await db.prepare("SELECT 1 FROM blacklist WHERE user_id=?").bind(u.user_id).first();
        u.is_banned = !!ban;
      }
      return Response.json({ list: users });
    }
  }

  // 操作 (封禁/删除)
  if (request.method === "POST") {
    if (!await verifyBody()) return Response.json({ error: "无权" }, { status: 403 });
    const body = await request.json();
    
    if (action === 'manage_ride' && body.type === 'delete') {
      await db.prepare("DELETE FROM rides WHERE id=?").bind(body.id).run();
    }
    if (action === 'manage_user') {
      if (body.type === 'ban') {
        await db.prepare("INSERT OR IGNORE INTO blacklist (user_id) VALUES (?)").bind(body.user_id).run();
        await db.prepare("DELETE FROM rides WHERE user_id=?").bind(body.user_id).run(); // 封禁即删帖
      } else {
        await db.prepare("DELETE FROM blacklist WHERE user_id=?").bind(body.user_id).run();
      }
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown action" });
}
