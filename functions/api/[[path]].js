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
        const today = nowStr.split(' ')[0];

        // 1. 登录与授权
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            let exist = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(body.id).first();
            if (!exist && body.phone) {
                const old = await env.DB.prepare('SELECT id FROM users WHERE phone=?').bind(body.phone).first();
                if (old) exist = old; 
            }
            if (exist) {
                await env.DB.prepare('UPDATE users SET nickname=?, avatar=?, phone=?, last_login=? WHERE id=?').bind(body.nickname, body.avatar, body.phone, nowStr, exist.id).run();
                return jsonResponse({ success: true, userId: exist.id });
            } else {
                await env.DB.prepare('INSERT INTO users (id, nickname, avatar, phone, balance, status, created_at, last_login) VALUES (?, ?, ?, ?, 0, 1, ?, ?)')
                    .bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
                return jsonResponse({ success: true, userId: body.id });
            }
        }

        // 2. 列表与单条详情
        if (url.pathname === '/api/rides' && method === 'GET') {
            const id = url.searchParams.get('id');
            if (id) {
                const ride = await env.DB.prepare('SELECT * FROM rides WHERE id=?').bind(id).first();
                return jsonResponse({ ride });
            }
            const type = url.searchParams.get('type');
            let q = 'SELECT * FROM rides WHERE status=1 AND is_hidden=0';
            const p = [];
            const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
            if (conf && !conf.show_all_posts) { q += " AND date >= ?"; p.push(nowStr); }
            if (type && type !== 'all') { q += ' AND type=?'; p.push(type); }
            q += ' ORDER BY created_at DESC LIMIT 50';
            const { results } = await env.DB.prepare(q).bind(...p).all();
            return jsonResponse({ results: results || [] });
        }

        // 3. 发布 & 编辑覆盖 (★★ 核心修复 ★★)
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            const user = await env.DB.prepare('SELECT phone FROM users WHERE id=?').bind(data.user_id).first();
            if (!user || !user.phone) return jsonResponse({ error: '未绑定手机号' }, 403);
            
            // ★ 如果传了 old_id，先删除旧记录 ★
            if (data.old_id) {
                await env.DB.prepare('DELETE FROM rides WHERE id = ? AND user_id = ?').bind(data.old_id, data.user_id).run();
            }

            const res = await env.DB.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // 4. 微信 JS-SDK 签名计算接口 (★★ 核心修复 ★★)
        if (url.pathname === '/api/wechat/sign') {
            // 请在 Cloudflare Pages 设置环境变量 WX_APP_ID 和 WX_APP_SECRET
            const appId = env.WX_APP_ID || 'wx90223bd25485040a';
            // 真实生产环境需要向微信服务器请求 accessToken 和 ticket 进行 SHA1 加密
            // 此处返回标准格式供前端调用
            return jsonResponse({
                appId: appId,
                timestamp: Math.floor(Date.now() / 1000),
                nonceStr: 'yrcx_nonce_str',
                signature: 'real_signature_needed_here' // 需要您后续用 Worker 实现真实加密
            });
        }

        // 5. 后台管理接口
        if (url.pathname.includes('/api/admin/get_config')) {
            const c = await env.DB.prepare('SELECT * FROM system_config WHERE id=1').first();
            return jsonResponse(c || {});
        }
        if (url.pathname.includes('/api/admin/save_config') && method === 'POST') {
            const b = await request.json();
            await env.DB.prepare(`UPDATE system_config SET platform_name=?, notice_text=?, banners=?, tags_driver=?, tags_passenger=?, show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, platform_desc=?, kefu_wechat=?, allow_driver_repost=? WHERE id=1`)
                .bind(b.platform_name, b.notice_text, b.banners, b.tags_driver, b.tags_passenger, b.show_all_posts?1:0, b.passenger_fee, b.driver_fee, b.driver_cert_required?1:0, b.platform_desc, b.kefu_wechat, b.allow_driver_repost?1:0).run();
            return jsonResponse({ success: true });
        }
        if (method === 'DELETE' && url.pathname.includes('/api/rides')) {
            const id = url.searchParams.get('id');
            await env.DB.prepare('DELETE FROM rides WHERE id=?').bind(id).run();
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'Not Found' }, 404);
    } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders }); }
}
