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
    return Response.json({ error: "失败" }, { status: 401 });
  }

  // 获取配置 (公开)
  if (request.method === "GET" && action === 'get_config') {
    const { results } = await db.prepare("SELECT * FROM system_config").all();
    const config = {};
    if(results) results.forEach(item => { config[item.key] = item.value; });
    return Response.json(config);
  }

  // --- 鉴权 ---
  const token = url.searchParams.get("token"); 
  const verify = async () => {
    try {
      if(token === ADMIN_PWD) return true;
      const b = await request.clone().json();
      return b.auth_token === ADMIN_PWD;
    } catch { return false; }
  };

  if (action === 'save_config') { // 逻辑在 rides.js 复用了，这里留空或删掉均可，前端调用 rides 接口
    return Response.json({success:true}); 
  }

  // 获取拼车列表 (管理端)
  if (action === 'get_rides') {
    if (!token || token !== ADMIN_PWD) return Response.json({ error: "无权" }, { status: 403 });
    const { results } = await db.prepare("SELECT * FROM rides ORDER BY id DESC LIMIT 50").all();
    return Response.json({ list: results || [] });
  }

  // 获取用户列表 (聚合)
  if (action === 'get_users') {
    if (!token || token !== ADMIN_PWD) return Response.json({ error: "无权" }, { status: 403 });
    const { results } = await db.prepare("SELECT user_id, COUNT(*) as count FROM rides GROUP BY user_id ORDER BY count DESC LIMIT 50").all();
    const users = results || [];
    for(let u of users) {
      const ban = await db.prepare("SELECT 1 FROM blacklist WHERE user_id=?").bind(u.user_id).first();
      u.is_banned = !!ban;
    }
    return Response.json({ list: users });
  }

  // 操作 (删帖/封禁)
  if (request.method === "POST") {
    if (!await verify()) return Response.json({ error: "无权" }, { status: 403 });
    const body = await request.json();
    
    if (action === 'manage_ride') {
      if (body.type === 'delete') await db.prepare("DELETE FROM rides WHERE id=?").bind(body.id).run();
    }
    if (action === 'manage_user') {
      if (body.type === 'ban') {
        await db.prepare("INSERT OR IGNORE INTO blacklist (user_id) VALUES (?)").bind(body.user_id).run();
        await db.prepare("DELETE FROM rides WHERE user_id=?").bind(body.user_id).run(); // 封禁同时删帖
      } else {
        await db.prepare("DELETE FROM blacklist WHERE user_id=?").bind(body.user_id).run();
      }
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "API Error" });
}
