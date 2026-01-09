export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PWD = env.ADMIN_PWD || "admin888"; 
  const SYS_USER = env.ADMIN_USER || "admin";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 获取配置 (公开，增加容错)
  if (request.method === "GET" && action === 'get_config') {
    try {
      const { results } = await db.prepare("SELECT * FROM system_config").all();
      const config = {};
      // 必须确保返回的是 JSON 对象
      if(results) results.forEach(item => { config[item.key] = item.value; });
      return Response.json(config);
    } catch (e) {
      // 数据库报错也返回空对象，防止前端崩
      return Response.json({});
    }
  }

  // 2. 登录
  if (request.method === "POST" && action === 'login') {
    const body = await request.json();
    if (body.username === SYS_USER && body.password === ADMIN_PWD) {
      return Response.json({ success: true, token: ADMIN_PWD });
    }
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  // 3. 保存配置
  if (request.method === "POST" && action === 'save_config') {
     const body = await request.json();
     if (body.auth_token !== ADMIN_PWD) return Response.json({ error: "无权" }, { status: 403 });
     
     const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
     const batch = [];
     // 强制转字符串存储
     for (const [k, v] of Object.entries(body.config)) {
       batch.push(stmt.bind(k, String(v === undefined || v === null ? '' : v)));
     }
     await db.batch(batch);
     return Response.json({ success: true });
  }

  // 4. 数据管理 (列表/删除/封禁) - 需鉴权
  const token = url.searchParams.get("token");
  if (request.method === "GET") {
    if (token !== ADMIN_PWD) return Response.json({ error: "无权", list: [] }, { status: 403 });
    
    if (action === 'get_rides') {
      const { results } = await db.prepare("SELECT * FROM rides ORDER BY id DESC LIMIT 50").all();
      return Response.json({ list: results || [] });
    }
    if (action === 'get_users') {
      const { results } = await db.prepare("SELECT user_id, COUNT(*) as post_count FROM rides GROUP BY user_id ORDER BY post_count DESC LIMIT 50").all();
      const users = results || [];
      for(let u of users) {
        const ban = await db.prepare("SELECT 1 FROM blacklist WHERE user_id=?").bind(u.user_id).first();
        u.is_banned = !!ban;
      }
      return Response.json({ list: users });
    }
  }

  if (request.method === "POST") {
    const body = await request.json();
    if (body.auth_token !== ADMIN_PWD) return Response.json({ error: "无权" }, { status: 403 });
    
    if (action === 'manage_ride' && body.type === 'delete') {
      await db.prepare("DELETE FROM rides WHERE id=?").bind(body.id).run();
    }
    if (action === 'manage_user') {
      if (body.type === 'ban') {
        await db.prepare("INSERT OR IGNORE INTO blacklist (user_id) VALUES (?)").bind(body.user_id).run();
        await db.prepare("DELETE FROM rides WHERE user_id=?").bind(body.user_id).run();
      } else {
        await db.prepare("DELETE FROM blacklist WHERE user_id=?").bind(body.user_id).run();
      }
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Unknown" });
}
