export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  // 建议在Cloudflare后台设置环境变量 ADMIN_PWD，否则默认密码 admin888
  const SYS_USER = env.ADMIN_USER || "admin";
  const SYS_PWD = env.ADMIN_PWD || "admin888";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 管理员登录
  if (request.method === "POST" && action === 'login') {
    try {
      const body = await request.json();
      if (body.username === SYS_USER && body.password === SYS_PWD) {
        return Response.json({ success: true, token: SYS_PWD });
      }
      return Response.json({ error: "账号或密码错误" }, { status: 401 });
    } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
  }

  // 2. 获取配置 (公开接口，防白屏关键)
  if (request.method === "GET" && action === 'get_config') {
    try {
      const { results } = await db.prepare("SELECT * FROM system_config").all();
      const config = {};
      // 设置默认值防止前端报错
      if (results) results.forEach(item => { config[item.key] = item.value; });
      return Response.json(config);
    } catch (e) {
      // 数据库报错时返回空对象，防止前端白屏
      return Response.json({});
    }
  }

  // --- 以下接口需要鉴权 ---
  const verify = async (req) => {
    try { const b = await req.clone().json(); return b.auth_token === SYS_PWD; } catch { return false; }
  };

  // 3. 保存配置
  if (request.method === "POST" && action === 'save_config') {
    if (!await verify(request)) return Response.json({ error: "无权操作" }, { status: 403 });
    const body = await request.json();
    const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    const batch = [];
    // 动态保存所有字段
    for (const [k, v] of Object.entries(body.config)) {
      if(k !== 'auth_token') batch.push(stmt.bind(k, String(v || '')));
    }
    await db.batch(batch);
    return Response.json({ success: true });
  }

  // 4. 获取拼车列表 (后台专用)
  if (request.method === "GET" && action === 'get_rides') {
    if (url.searchParams.get("token") !== SYS_PWD) return Response.json({ error: "无权" }, { status: 403 });
    const { results } = await db.prepare("SELECT * FROM rides ORDER BY id DESC LIMIT 50").all();
    return Response.json({ list: results || [] });
  }

  // 5. 管理拼车 (删除)
  if (request.method === "POST" && action === 'manage_ride') {
    if (!await verify(request)) return Response.json({ error: "无权" }, { status: 403 });
    const body = await request.json();
    if (body.type === 'delete') {
      await db.prepare("DELETE FROM rides WHERE id = ?").bind(body.id).run();
    }
    return Response.json({ success: true });
  }

  // 6. 获取用户列表
  if (request.method === "GET" && action === 'get_users') {
    if (url.searchParams.get("token") !== SYS_PWD) return Response.json({ error: "无权" }, { status: 403 });
    // 简单聚合查询
    const { results } = await db.prepare("SELECT user_id, COUNT(*) as post_count, MAX(date) as last_active FROM rides GROUP BY user_id ORDER BY last_active DESC LIMIT 50").all();
    
    // 查询封禁状态
    const users = results || [];
    for (let u of users) {
      const banned = await db.prepare("SELECT 1 FROM blacklist WHERE user_id = ?").bind(u.user_id).first();
      u.is_banned = !!banned;
    }
    return Response.json({ list: users });
  }

  // 7. 封禁/解封用户
  if (request.method === "POST" && action === 'manage_user') {
    if (!await verify(request)) return Response.json({ error: "无权" }, { status: 403 });
    const body = await request.json();
    if (body.type === 'ban') {
      await db.prepare("INSERT OR IGNORE INTO blacklist (user_id, reason) VALUES (?, 'admin')").bind(body.user_id).run();
      await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(body.user_id).run(); // 封禁同时删帖
    } else {
      await db.prepare("DELETE FROM blacklist WHERE user_id = ?").bind(body.user_id).run();
    }
    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
