export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const ADMIN_PWD = env.ADMIN_PWD || "admin888";

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  // 1. 获取配置
  if (request.method === "GET" && action === 'get_config') {
    try {
      const { results } = await db.prepare("SELECT * FROM system_config").all();
      const config = {};
      if(results) results.forEach(item => { config[item.key] = item.value; });
      return Response.json(config);
    } catch (e) { return Response.json({}); }
  }

  // 2. 更新配置
  if (request.method === "POST" && action === 'update_config') {
    const body = await request.json();
    if (body.admin_key !== ADMIN_PWD) return Response.json({ error: "密码错误" }, { status: 403 });
    const stmt = db.prepare("INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    const batch = [];
    for (const [k, v] of Object.entries(body.config)) batch.push(stmt.bind(k, String(v || '')));
    await db.batch(batch);
    return Response.json({ success: true });
  }

  // 3. 获取列表 (首页/我的)
  if (request.method === "GET") {
    let showExpired = 'false';
    try {
      const row = await db.prepare("SELECT value FROM system_config WHERE key = 'show_expired'").first();
      if(row) showExpired = row.value;
    } catch(e){}

    let sql = "SELECT * FROM rides";
    const params = [];
    const conditions = [];

    const filterUserId = url.searchParams.get("filter_user_id");
    
    if (filterUserId) {
      // 个人中心逻辑：不过滤过期，只看ID
      conditions.push("user_id = ?");
      params.push(filterUserId);
    } else {
      // 首页逻辑
      if (showExpired !== 'true') {
        const now = new Date().toISOString().slice(0, 16);
        conditions.push(`date >= '${now}'`);
      }
      const type = url.searchParams.get("type");
      if (type && type !== 'all') {
        conditions.push("type = ?");
        params.push(type);
      }
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    
    // 排序：我的发布按ID倒序；首页按置顶+时间正序
    if (filterUserId) sql += " ORDER BY id DESC LIMIT 50";
    else sql += " ORDER BY is_top DESC, date ASC LIMIT 100";

    const { results } = await db.prepare(sql).bind(...params).all();
    return Response.json({ results: results || [] });
  }

  // 4. POST (发布/修改)
  if (request.method === "POST") {
    const body = await request.json();
    
    // 修改
    if (body.action === 'update') {
      await db.prepare(`UPDATE rides SET origin=?, destination=?, date=?, seats=?, price=?, remark=?, contact=?, car_model=? WHERE id=?`)
        .bind(body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, body.car_model||'', body.id).run();
      return Response.json({ success: true });
    }

    // 封禁检查
    const banned = await db.prepare("SELECT 1 FROM blacklist WHERE user_id = ?").bind(body.user_id).first();
    if (banned) return Response.json({ error: "账号被封禁" }, { status: 403 });

    // 发布
    await db.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, pay_amount, is_top, car_model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(body.user_id, body.type, body.origin, body.destination, body.date, body.seats, body.price, body.remark, body.contact, 0, 0, body.car_model||'').run();
    
    return Response.json({ success: true });
  }

  // 5. 删除
  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    const uid = url.searchParams.get("user_id");
    await db.prepare("DELETE FROM rides WHERE id = ? AND user_id = ?").bind(id, uid).run();
    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
