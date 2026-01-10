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
        if (!env.DB) throw new Error("D1 Database Not Bound");
        const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

        // 1. 用户登录 (智能容错)
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            if (!body.id) return jsonResponse({ error: 'ID Missing' }, 400);

            const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();
            
            if (existing) {
                // 更新
                await env.DB.prepare(`UPDATE users SET nickname=?, avatar=?, phone=?, last_login=? WHERE id=?`)
                    .bind(body.nickname, body.avatar, body.phone, nowStr, body.id).run();
            } else {
                // 插入 (包含 gender, referrer 默认值)
                await env.DB.prepare(`
                    INSERT INTO users (id, nickname, avatar, phone, gender, referrer, balance, status, created_at, last_login) 
                    VALUES (?, ?, ?, ?, '未知', '无', 0, 1, ?, ?)
                `).bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
            }
            return jsonResponse({ success: true });
        }

        // 2. 发布拼车 (★核心修复：封号检测★)
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            // 查用户状态
            const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id = ?').bind(data.user_id).first();
            
            if (!user || !user.phone) return jsonResponse({ error: '请先绑定手机号' }, 403);
            
            // ★ 如果 status 不是 1 (正常)，则拒绝发布
            if (user.status !== 1) return jsonResponse({ error: '账号已被封禁，无法发布' }, 403);

            const res = await env.DB.prepare(`
                INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
            
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // 3. 列表查询
        if (url.pathname === '/api/rides' && method === 'GET') {
            const type = url.searchParams.get('type');
            let q = 'SELECT * FROM rides WHERE status = 1 AND is_hidden = 0';
            const p = [];
            
            const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
            if (conf && !conf.show_all_posts) q += " AND date >= ?"; 
            if (conf && !conf.show_all_posts) p.push(nowStr);

            if (type && type !== 'all') { q += ' AND type = ?'; p.push(type); }
            
            q += ' ORDER BY created_at DESC LIMIT 100';
            const { results } = await env.DB.prepare(q).bind(...p).all();
            return jsonResponse({ results: results || [] });
        }

        // 4. 后台管理接口 (支持封号操作)
        if (url.pathname === '/api/admin/users') {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
            return jsonResponse({ results: results || [] });
        }
        if (url.pathname === '/api/admin/all_rides') {
            const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY created_at DESC LIMIT 100').all();
            return jsonResponse({ results: results || [] });
        }
        // 封号/解封接口
        if (url.pathname === '/api/admin/toggle_user' && method === 'POST') {
            const body = await request.json();
            // body.status: 1正常, 0封号
            await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, body.id).run();
            return jsonResponse({ success: true });
        }
        // 隐藏/显示帖子接口
        if (url.pathname === '/api/admin/toggle_ride' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE rides SET is_hidden = ? WHERE id = ?').bind(body.hidden, body.id).run();
            return jsonResponse({ success: true });
        }

        // 5. 配置管理
        if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
            const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
            return jsonResponse(config || {});
        }
        if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config') {
            const body = await request.json();
            await env.DB.prepare(`UPDATE system_config SET platform_name=?, notice_text=?, banners=?, tags_driver=?, tags_passenger=?, show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, allow_driver_repost=? WHERE id=1`)
               .bind(body.platform_name, body.notice_text, body.banners, body.tags_driver, body.tags_passenger, body.show_all_posts?1:0, body.passenger_fee, body.driver_fee, body.driver_cert_required?1:0, body.allow_driver_repost?1:0).run();
            return jsonResponse({ success: true });
        }

        // 删除
        if (method === 'DELETE') {
            const id = url.searchParams.get('id');
            await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'API Not Found' }, 404);

    } catch (e) {
        return new Response(JSON.stringify({ error: "Server Error", message: e.message }), { status: 500, headers: corsHeaders });
    }
}
