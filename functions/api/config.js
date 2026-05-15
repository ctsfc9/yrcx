export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 1. 获取全局配置
  if (request.method === 'GET') {
    try {
      const config = await db.prepare("SELECT * FROM system_config LIMIT 1").first();
      return new Response(JSON.stringify(config || {}), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // 2. 保存/更新全局配置 (支持后台修改)
  if (request.method === 'POST') {
    try {
      const d = await request.json();
      
      await db.prepare(`
        UPDATE system_config 
        SET notice=?, tags_driver=?, tags_passenger=?, contact_qr=?, top_fee=?, publish_fee=?, amap_key=? 
        WHERE id=1
      `).bind(
        d.notice || '',
        d.tags_driver || '',
        d.tags_passenger || '',
        d.contact_qr || '',
        d.top_fee || 0,
        d.publish_fee || 0,
        d.amap_key || '' // 完美接驳刚才新增的高德地图Key字段
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: '保存配置失败: ' + e.message }), { 
        status: 500, headers: { 'Content-Type': 'application/json' } 
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
