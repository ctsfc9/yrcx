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

        // ======================= 1. 用户登录 =======================
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            if (!body.id) return jsonResponse({ error: 'ID Missing' }, 400);

            const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();
            
            if (existing) {
                await env.DB.prepare(`UPDATE users SET nickname=?, avatar=?, phone=?, last_login=? WHERE id=?`)
                    .bind(body.nickname, body.avatar, body.phone, nowStr, body.id).run();
            } else {
                await env.DB.prepare(`INSERT INTO users (id, nickname, avatar, phone, balance, status, created_at, last_login) VALUES (?, ?, ?, ?, 0, 1, ?, ?)`)
                    .bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
            }
            return jsonResponse({ success: true });
        }

        // ======================= 2. 发布拼车 =======================
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id = ?').bind(data.user_id).first();
            
            if (!user || !user.phone) return jsonResponse({ error: '请先绑定手机号' }, 403);
            if (user.status !== 1) return jsonResponse({ error: '账号已被封禁' }, 403);

            const res = await env.DB.prepare(`
                INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
            
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // ======================= 3. 公共列表 =======================
        if (url.pathname === '/api/rides' && method === 'GET') {
            const type = url.searchParams.get('type');
            // 只显示 status=1 且 is_hidden=0 的帖子
            let q = 'SELECT * FROM rides WHERE status = 1 AND is_hidden = 0';
            const p = [];
            
            const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
            // 注意：这里简单比对字符串日期，实际生产建议存时间戳
            if (conf && !conf.show_all_posts) q += " AND date >= ?"; 
            if (conf && !conf.show_all_posts) p.push(nowStr);

            if (type && type !== 'all') { q += ' AND type = ?'; p.push(type); }
            
            q += ' ORDER BY created_at DESC LIMIT 100';
            const { results } = await env.DB.prepare(q).bind(...p).all();
            return jsonResponse({ results: results || [] });
        }

        // ======================= 4. 后台管理接口 (增强版) =======================
        if (url.pathname === '/api/admin/users') {
            // 获取更完整的用户字段
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
            return jsonResponse({ results: results || [] });
        }

        if (url.pathname === '/api/admin/all_rides') {
            // 获取所有状态的拼车，且关联用户信息（简单联表或前端匹配，这里先单表查）
            const { results } = await env.DB.prepare(`
                SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar 
                FROM rides r 
                LEFT JOIN users u ON r.user_id = u.id 
                WHERE r.status != -999 
                ORDER BY r.created_at DESC LIMIT 100
            `).all();
            return jsonResponse({ results: results || [] });
        }

        // 切换 显示/隐藏
        if (url.pathname === '/api/admin/toggle_ride' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE rides SET is_hidden = ? WHERE id = ?').bind(body.hidden, body.id).run();
            return jsonResponse({ success: true });
        }
        
        // 切换 用户状态 (封禁)
        if (url.pathname === '/api/admin/toggle_user' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, body.id).run();
            return jsonResponse({ success: true });
        }

        // ======================= 5. 配置管理 =======================
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
