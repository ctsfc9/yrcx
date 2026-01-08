export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PWD = env.ADMIN_PWD || "admin888"; 
  const SYS_USER = env.ADMIN_USER || "admin";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 登录
  if (request.method === "POST" && action === 'login') {
    const body = await request.json();
    if (body.username === SYS_USER && body.password === ADMIN_PWD) {
      return Response.json({ success: true, token: ADMIN_PWD });
    }
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  // 2. 获取系统配置 (完全公开，防止后台读取失败)
  if (request.method === "GET" && action === 'get_config') {
    try {
      const { results } = await db.prepare("SELECT * FROM system_config").all();
      const config = {};
      // 赋予默认值，防止数据库为空时前端崩溃
      if(results) results.forEach(item => { config[item.key] = item.value; });
      return Response.json(config);
    } catch (e) {
      return Response.json({});
    }
  }

  // --- 以下接口需要 Token 鉴权 ---
  const token = url.searchParams.get("token"); 
  const verifyBody = async () => {
    try { const b = await request.clone().json(); return b.auth_token === ADMIN_PWD; } catch { return false; }
  };

  // 3. 获取数据 (拼车/用户)
  if (request.method === "GET") {
    if (!token || token !== ADMIN_PWD) return Response.json({ error: "无权访问", list: [] }, { status: 403 });
    
    if (action === 'get_rides') {
      const { results } = await db.prepare("SELECT * FROM rides ORDER BY id DESC LIMIT 100").all();
      return Response.json({ list: results || [] });
    }
    if (action === 'get_users') {
      const { results } = await db.prepare("SELECT user_id, COUNT(*) as post_count FROM rides GROUP BY user_id ORDER BY post_count DESC LIMIT 100").all();
      const users = results || [];
      for(let u of users) {
        const ban = await db.prepare("SELECT 1 FROM blacklist WHERE user_id=?").bind(u.user_id).first();
        u.is_banned = !!ban;
      }
      return Response.json({ list: users });
    }
  }

  // 4. 操作 (保存配置/封禁/删除)
  if (request.method === "POST") {
    // 验证保存配置的权限
    if (action === 'save_config') {
       const body = await request.json();
       if (body.auth_token !== ADMIN_PWD) return Response.json({ error: "无权" }, { status: 403 });
       const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
       const batch = [];
       for (const [k, v] of Object.entries(body.config)) batch.push(stmt.bind(k, String(v || '')));
       await db.batch(batch);
       return Response.json({ success: true });
    }

    if (!await verifyBody()) return Response.json({ error: "无权" }, { status: 403 });
    const body = await request.json();
    
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

  return Response.json({ error: "Unknown action" });
}
