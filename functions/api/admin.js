export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 从环境变量获取账号密码 (如果没有设置，默认 admin/admin888)
  const SYS_USER = env.ADMIN_USER || "admin";
  const SYS_PWD = env.ADMIN_PWD || "admin888";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 登录验证
  if (request.method === "POST" && action === 'login') {
    try {
      const body = await request.json();
      if (body.username === SYS_USER && body.password === SYS_PWD) {
        return Response.json({ success: true, token: 'logged_in' });
      }
      return Response.json({ error: "账号或密码错误" }, { status: 401 });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 2. 获取配置 (公开接口，用于首页加载)
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

  // 3. 保存配置 (需要鉴权)
  if (request.method === "POST" && action === 'save_config') {
    try {
      const body = await request.json();
      // 简单鉴权：检查请求中是否包含正确密码 (实际生产建议用 Cookie/Session，这里简化处理)
      if (body.auth_token !== SYS_PWD) { 
        return Response.json({ error: "无权操作" }, { status: 403 });
      }

      // 批量更新所有配置
      const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      
      // 这里的字段要跟前端一一对应
      await db.batch([
        stmt.bind('publish_fee', String(body.publish_fee)),
        stmt.bind('top_fee', String(body.top_fee)),
        stmt.bind('notice_text', body.notice_text),
        stmt.bind('share_title', body.share_title),
        stmt.bind('share_desc', body.share_desc),
        stmt.bind('share_img', body.share_img)
      ]);

      return Response.json({ success: true });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
