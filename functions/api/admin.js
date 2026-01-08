export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PASSWORD = "admin888"; // 你的管理员密码

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 公开接口：获取系统配置 (给前端首页用)
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

  // 2. 管理接口：保存配置 (需要密码)
  if (request.method === "POST" && action === 'save_config') {
    try {
      const body = await request.json();
      if (body.password !== ADMIN_PASSWORD) {
        return Response.json({ error: "密码错误" }, { status: 403 });
      }

      // 批量更新配置
      const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      await db.batch([
        stmt.bind('publish_fee', String(body.publish_fee)),
        stmt.bind('top_fee', String(body.top_fee)),
        stmt.bind('notice_text', body.notice_text)
      ]);

      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
