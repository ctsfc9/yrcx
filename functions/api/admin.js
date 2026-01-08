export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const SYS_USER = env.ADMIN_USER || "admin";
  const SYS_PWD = env.ADMIN_PWD || "admin888";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // --- 鉴权中间件 ---
  const verifyAuth = async (req) => {
    try {
      const body = await req.clone().json();
      return body.auth_token === SYS_PWD;
    } catch { return false; }
  };

  // 1. 登录
  if (request.method === "POST" && action === 'login') {
    const body = await request.json();
    if (body.username === SYS_USER && body.password === SYS_PWD) {
      return Response.json({ success: true, token: SYS_PWD });
    }
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  // 2. 获取全量配置 (GET)
  if (request.method === "GET" && action === 'get_config') {
    try {
      const { results } = await db.prepare("SELECT * FROM system_config").all();
      const config = {};
      results.forEach(item => { config[item.key] = item.value; });
      return Response.json(config);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 3. 保存配置 (POST)
  if (request.method === "POST" && action === 'save_config') {
    if (!await verifyAuth(request)) return Response.json({ error: "无权操作" }, { status: 403 });
    try {
      const body = await request.json();
      const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      
      // 动态批量更新所有传入的字段
      const batch = [];
      for (const [key, val] of Object.entries(body.config)) {
        batch.push(stmt.bind(key, String(val)));
      }
      
      await db.batch(batch);
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 4. 获取拼车列表 (GET - 管理员视角)
  if (request.method === "GET" && action === 'get_rides') {
    // 简单验证 token (通过 URL 参数)
    if (url.searchParams.get("token") !== SYS_PWD) return Response.json({ error: "无权操作" }, { status: 403 });
    
    const page = parseInt(url.searchParams.get("page")) || 1;
    const size = 20;
    const offset = (page - 1) * size;
    
    try {
      const { results } = await db.prepare(`SELECT * FROM rides ORDER BY id DESC LIMIT ? OFFSET ?`).bind(size, offset).all();
      const total = await db.prepare(`SELECT COUNT(*) as count FROM rides`).first();
      return Response.json({ list: results, total: total.count });
    } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
  }

  // 5. 删除/修改拼车信息 (POST)
  if (request.method === "POST" && action === 'manage_ride') {
    if (!await verifyAuth(request)) return Response.json({ error: "无权操作" }, { status: 403 });
    const body = await request.json();
    
    if (body.type === 'delete') {
      await db.prepare("DELETE FROM rides WHERE id = ?").bind(body.id).run();
      return Response.json({ success: true });
    }
    if (body.type === 'update') {
      // 简单修改示例
      await db.prepare("UPDATE rides SET remark = ?, is_top = ? WHERE id = ?")
        .bind(body.remark, body.is_top, body.id).run();
      return Response.json({ success: true });
    }
  }

  // 6. 用户管理 (获取/封禁)
  if (request.method === "POST" && action === 'manage_user') {
    if (!await verifyAuth(request)) return Response.json({ error: "无权操作" }, { status: 403 });
    const body = await request.json();

    if (body.type === 'ban') {
      await db.prepare("INSERT OR IGNORE INTO blacklist (user_id, reason) VALUES (?, ?)").bind(body.user_id, '管理员封禁').run();
      // 封禁同时删除该用户所有帖子
      await db.prepare("DELETE FROM rides WHERE user_id = ?").bind(body.user_id).run();
      return Response.json({ success: true });
    }
    if (body.type === 'unban') {
      await db.prepare("DELETE FROM blacklist WHERE user_id = ?").bind(body.user_id).run();
      return Response.json({ success: true });
    }
  }

  // 7. 获取用户列表 (聚合查询，统计发帖数)
  if (request.method === "GET" && action === 'get_users') {
    if (url.searchParams.get("token") !== SYS_PWD) return Response.json({ error: "无权操作" }, { status: 403 });
    
    // 这是一个简单的统计，实际用户表可能需要单独建立，这里从 rides 表聚合
    const sql = `
      SELECT user_id, COUNT(*) as post_count, MAX(created_at) as last_active,
      (SELECT 1 FROM blacklist WHERE user_id = rides.user_id) as is_banned
      FROM rides GROUP BY user_id ORDER BY last_active DESC LIMIT 50
    `;
    const { results } = await db.prepare(sql).all();
    return Response.json({ list: results });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
