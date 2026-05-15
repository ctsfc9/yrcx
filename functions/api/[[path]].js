export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;
    const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' };

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        if (!env.DB) throw new Error("D1 Not Bound");
        const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

        // 1. 发布 / 编辑行程
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            
            // ★★★ 编辑覆盖逻辑：如果传了 old_id，先删除旧数据 ★★★
            if (data.old_id) {
                await env.DB.prepare('DELETE FROM rides WHERE id = ? AND user_id = ?').bind(data.old_id, data.user_id).run();
            }

            const res = await env.DB.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // 2. 获取列表 / 详情
        if (url.pathname === '/api/rides' && method === 'GET') {
            const id = url.searchParams.get('id');
            if (id) {
                const ride = await env.DB.prepare('SELECT * FROM rides WHERE id=?').bind(id).first();
                return jsonResponse({ ride });
            }
            const { results } = await env.DB.prepare('SELECT * FROM rides WHERE status=1 AND is_hidden=0 ORDER BY created_at DESC LIMIT 50').all();
            return jsonResponse({ results });
        }
        
        // 3. 微信 JS-SDK 签名获取 (骨架预留)
        if (url.pathname === '/api/wechat/sign') {
            const reqUrl = url.searchParams.get('url');
            // 注意：WX_APP_ID 等需要配置在 CF 的环境变量中
            // 真实生产中，这里需要请求微信服务器获取 ticket 并进行 SHA1 签名
            // 目前返回模拟结构防止前端报错
            return jsonResponse({
                appId: env.WX_APP_ID || 'wx90223bd25485040a',
                timestamp: Math.floor(Date.now() / 1000),
                nonceStr: 'random_string',
                signature: 'temp_signature_need_real_sha1' 
            });
        }

        // 后台接口... (保持原有逻辑)
        if (url.pathname.includes('/api/admin/get_config')) {
            const c = await env.DB.prepare('SELECT * FROM system_config WHERE id=1').first();
            return jsonResponse(c || {});
        }

        return jsonResponse({ error: 'Not Found' }, 404);
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}
