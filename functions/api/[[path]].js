/**
 * V49 后端 - 修复管理功能与状态更新
 */
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
        const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
        const today = nowStr.split(' ')[0];

        // ======================= 1. 业务接口 =======================
        
        // 登录
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            const exist = await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(body.id).first();
            if (exist) {
                await env.DB.prepare('UPDATE users SET nickname=?, avatar=?, phone=?, last_login=? WHERE id=?')
                    .bind(body.nickname, body.avatar, body.phone, nowStr, body.id).run();
            } else {
                try {
                    await env.DB.prepare('INSERT INTO users (id, nickname, avatar, phone, balance, status, created_at, last_login) VALUES (?, ?, ?, ?, 0, 1, ?, ?)')
                        .bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
                } catch(e) {
                    await env.DB.prepare('INSERT INTO users (id, nickname, avatar, phone, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)')
                        .bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
                }
            }
            return jsonResponse({ success: true });
        }

        // 发布
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id=?').bind(data.user_id).first();
            if (!user || !user.phone) return jsonResponse({ error: '请先绑定手机号' }, 403);
            if (user.status === 0) return jsonResponse({ error: '账号已被封禁' }, 403);

            const res = await env.DB.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // 列表
        if (url.pathname === '/api/rides' && method === 'GET') {
            const type = url.searchParams.get('type');
            let q = 'SELECT * FROM rides WHERE status=1 AND is_hidden=0';
            const p = [];
            const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
            if (conf && !conf.show_all_posts) { q += " AND date >= ?"; p.push(nowStr); }
            if (type && type !== 'all') { q += ' AND type=?'; p.push(type); }
            q += ' ORDER BY created_at DESC LIMIT 100';
            const { results } = await env.DB.prepare(q).bind(...p).all();
            return jsonResponse({ results: results || [] });
        }

        // ======================= 2. 后台管理 =======================
        
        // 统计
        if (url.pathname === '/api/admin/stats') {
            const totalUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first('c');
            const certifiedUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE is_certified=1').first('c');
            const male = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE gender='男'").first('c');
            const female = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE gender='女'").first('c');
            const newUsersToday = await env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE created_at LIKE '${today}%'`).first('c');
            return jsonResponse({ totalUsers, certifiedUsers, male, female, newUsersToday, monthRecharge: 0, todayRecharge: 0 });
        }

        // 用户管理
        if (url.pathname === '/api/admin/users') {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
            return jsonResponse({ results: results || [] });
        }
        
        // 封号/解封
        if (url.pathname === '/api/admin/toggle_user' && method === 'POST') {
            const body = await request.json();
            // 确保 status 是数字
            await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(Number(body.status), body.id).run();
            return jsonResponse({ success: true });
        }

        // 删除用户
        if (url.pathname === '/api/admin/user' && method === 'DELETE') {
            const id = url.searchParams.get('id');
            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
        }

        // 添加用户
        if (url.pathname === '/api/admin/add_user' && method === 'POST') {
            const body = await request.json();
            const newId = 'u_' + Date.now();
            await env.DB.prepare(`INSERT INTO users (id, nickname, phone, balance, status, created_at, last_login) VALUES (?, ?, ?, ?, 1, ?, ?)`).bind(newId, body.nickname, body.phone, Number(body.balance)||0, nowStr, nowStr).run();
            return jsonResponse({ success: true });
        }

        // 拼车管理
        if (url.pathname === '/api/admin/all_rides') {
            // 关联查询昵称头像
            const { results } = await env.DB.prepare(`
                SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar 
                FROM rides r LEFT JOIN users u ON r.user_id = u.id 
                ORDER BY r.created_at DESC LIMIT 100
            `).all();
            return jsonResponse({ results: results || [] });
        }

        // 隐藏/显示拼车
        if (url.pathname === '/api/admin/toggle_ride' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE rides SET is_hidden = ? WHERE id = ?').bind(Number(body.hidden), body.id).run();
            return jsonResponse({ success: true });
        }

        // 删除拼车 (通用删除)
        if (url.pathname === '/api/rides' && method === 'DELETE') {
            const id = url.searchParams.get('id');
            await env.DB.prepare('DELETE FROM rides WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
        }

        // 配置
        if (url.pathname === '/api/admin/get_config') {
            const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
            return jsonResponse(config || {});
        }
        if (url.pathname === '/api/admin/save_config') {
            const body = await request.json();
            await env.DB.prepare(`UPDATE system_config SET platform_name=?, notice_text=?, banners=?, tags_driver=?, tags_passenger=?, show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, allow_driver_repost=? WHERE id=1`)
               .bind(body.platform_name, body.notice_text, body.banners, body.tags_driver, body.tags_passenger, body.show_all_posts?1:0, body.passenger_fee, body.driver_fee, body.driver_cert_required?1:0, body.allow_driver_repost?1:0).run();
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'API Not Found' }, 404);

    } catch (e) {
        return new Response(JSON.stringify({ error: "Server Error", message: e.message }), { status: 500, headers: corsHeaders });
    }
}
