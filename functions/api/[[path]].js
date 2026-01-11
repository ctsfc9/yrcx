export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const jsonResponse = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        if (!env.DB) throw new Error("D1 Not Bound");
        const nowStr = new Date().toISOString();

        // 1. 登录
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
                await env.DB.prepare('INSERT INTO users (id, nickname, avatar, phone, status, created_at, last_login) VALUES (?, ?, ?, ?, 1, ?, ?)').bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
                return jsonResponse({ success: true, userId: body.id });
            }
        }

        // 2. 列表
        if (url.pathname === '/api/rides' && method === 'GET') {
            const { results } = await env.DB.prepare('SELECT * FROM rides WHERE status=1 AND is_hidden=0 ORDER BY created_at DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }

        // 3. 发布
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id=?').bind(data.user_id).first();
            if (!user || !user.phone) return jsonResponse({ error: '请先绑定手机号' }, 403);
            if (user.status === 0) return jsonResponse({ error: '账号已封禁' }, 403);

            const res = await env.DB.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // 4. 后台相关 (简化版，确保核心功能)
        if (url.pathname.startsWith('/api/admin')) {
             if (url.pathname.includes('users')) {
                 const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
                 return jsonResponse({ results: results || [] });
             }
             if (url.pathname.includes('all_rides')) {
                 const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY created_at DESC LIMIT 100').all();
                 return jsonResponse({ results: results || [] });
             }
             if (url.pathname.includes('get_config')) {
                 const c = await env.DB.prepare('SELECT * FROM system_config WHERE id=1').first();
                 return jsonResponse(c || {});
             }
             if (url.pathname.includes('save_config')) {
                 const b = await request.json();
                 await env.DB.prepare('UPDATE system_config SET platform_name=?, amap_key=?, notice_text=?, banners=? WHERE id=1').bind(b.platform_name, b.amap_key, b.notice_text, b.banners).run();
                 return jsonResponse({ success: true });
             }
             if (url.pathname.includes('toggle_user')) {
                 const b = await request.json();
                 await env.DB.prepare('UPDATE users SET status=? WHERE id=?').bind(b.status, b.id).run();
                 return jsonResponse({ success: true });
             }
             if (url.pathname.includes('user') && method === 'DELETE') {
                 const id = url.searchParams.get('id');
                 await env.DB.prepare('DELETE FROM users WHERE id=?').bind(id).run();
                 return jsonResponse({ success: true });
             }
             // 删除拼车
             if (url.pathname.includes('rides') && method === 'DELETE') {
                  await env.DB.prepare('DELETE FROM rides WHERE id=?').bind(url.searchParams.get('id')).run();
                  return jsonResponse({ success: true });
             }
        }
        
        return jsonResponse({ error: 'Not Found' }, 404);
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
