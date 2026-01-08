export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const SYS_USER = env.ADMIN_USER || "admin";
  const SYS_PWD = env.ADMIN_PWD || "admin888";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 登录
  if (request.method === "POST" && action === 'login') {
    const body = await request.json();
    if (body.username === SYS_USER && body.password === SYS_PWD) {
      return Response.json({ success: true, token: 'logged_in' }); // 实际应生成真实Token
    }
    return Response.json({ error: "账号或密码错误" }, { status: 401 });
  }

  // 2. 获取全量配置
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

  // 3. 保存配置 (含标签、Banner)
  if (request.method === "POST" && action === 'save_config') {
    try {
      const body = await request.json();
      if (body.auth_token !== SYS_PWD) return Response.json({ error: "无权操作" }, { status: 403 });

      const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      
      const batch = [
        stmt.bind('publish_fee', String(body.publish_fee)),
        stmt.bind('top_fee', String(body.top_fee)),
        stmt.bind('notice_text', body.notice_text),
        stmt.bind('share_title', body.share_title),
        stmt.bind('share_desc', body.share_desc),
        stmt.bind('share_img', body.share_img),
        stmt.bind('tags_driver', body.tags_driver),
        stmt.bind('tags_passenger', body.tags_passenger),
        stmt.bind('banners', body.banners)
      ];
      
      await db.batch(batch);
      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
