export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'GET') {
    const config = await env.DB.prepare("SELECT * FROM system_config LIMIT 1").first();
    return new Response(JSON.stringify(config || {}), { headers: { 'Content-Type': 'application/json' } });
  }
  if (request.method === 'POST') {
    const d = await request.json();
    await env.DB.prepare(`UPDATE system_config SET notice=?, tags_driver=?, tags_passenger=?, contact_qr=?, top_fee=?, publish_fee=?, amap_key=?, wx_appid=?, wx_appsecret=?, show_expired=? WHERE id=1`)
      .bind(d.notice||'', d.tags_driver||'', d.tags_passenger||'', d.contact_qr||'', d.top_fee||0, d.publish_fee||0, d.amap_key||'', d.wx_appid||'', d.wx_appsecret||'', d.show_expired ? 1 : 0).run();
    return new Response(JSON.stringify({ success: true }));
  }
}
