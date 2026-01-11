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
        const todayDate = nowStr.split(' ')[0]; // YYYY/MM/DD or YYYY-MM-DD

        // ======================= 1. 后台仪表盘统计 (新增) =======================
        if (url.pathname === '/api/admin/stats') {
            // 统计总用户
            const totalUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first('c');
            // 统计完善资料(已认证)
            const certifiedUsers = await env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE is_certified=1').first('c');
            // 性别
            const male = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE gender='男'").first('c');
            const female = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE gender='女'").first('c');
            
            // 今日新增
            const newUsersToday = await env.DB.prepare(`SELECT COUNT(*) as c FROM users WHERE created_at LIKE '${todayDate}%'`).first('c');
            
            // 充值统计 (基于 transactions 表)
            // 当月 (简单模糊匹配)
            const currentMonth = todayDate.substring(0, 7); // YYYY/MM
            const monthRecharge = await env.DB.prepare(`SELECT SUM(amount) as s FROM transactions WHERE type='recharge' AND created_at LIKE '${currentMonth}%'`).first('s');
            const todayRecharge = await env.DB.prepare(`SELECT SUM(amount) as s FROM transactions WHERE type='recharge' AND created_at LIKE '${todayDate}%'`).first('s');

            return jsonResponse({
                totalUsers, certifiedUsers, male, female, newUsersToday,
                monthRecharge: monthRecharge || 0,
                todayRecharge: todayRecharge || 0
            });
        }

        // ======================= 2. 用户登录 =======================
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            if (!body.id) return jsonResponse({ error: 'ID Missing' }, 400);

            const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();
            if (existing) {
                await env.DB.prepare('UPDATE users SET nickname=?, avatar=?, phone=?, last_login=? WHERE id=?')
                    .bind(body.nickname, body.avatar, body.phone, nowStr, body.id).run();
            } else {
                // 兼容插入
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
        // 封号/解封
        if (url.pathname === '/api/admin/toggle_user' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, body.id).run();
            return jsonResponse({ success: true });
        }
        // 删除用户
        if (url.pathname === '/api/admin/user' && method === 'DELETE') {
            const id = url.searchParams.get('id');
            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
        }

        // ======================= 3. 发布拼车 =======================
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

        // ======================= 4. 列表查询 =======================
        if (url.pathname === '/api/rides' && method === 'GET') {
            const type = url.searchParams.get('type');
            let q = 'SELECT * FROM rides WHERE status = 1 AND is_hidden = 0';
            const p = [];
            const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
            if (conf && !conf.show_all_posts) { q += " AND date >= ?"; p.push(nowStr); }
            if (type && type !== 'all') { q += ' AND type = ?'; p.push(type); }
            q += ' ORDER BY created_at DESC LIMIT 100';
            const { results } = await env.DB.prepare(q).bind(...p).all();
            return jsonResponse({ results: results || [] });
        }

        // ======================= 5. 后台管理 =======================
        if (url.pathname === '/api/admin/users') {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
            return jsonResponse({ results: results || [] });
        }
        if (url.pathname === '/api/admin/all_rides') {
            const { results } = await env.DB.prepare(`
                SELECT r.*, u.nickname as user_nickname, u.avatar as user_avatar 
                FROM rides r LEFT JOIN users u ON r.user_id = u.id 
                ORDER BY r.created_at DESC LIMIT 100
            `).all();
            return jsonResponse({ results: results || [] });
        }
        // ... (保持 toggle_user, toggle_ride, add_user, delete, config 等接口不变，参考上一个版本) ...
        // 为节省篇幅，这里略去重复的 save_config, toggle_user 等逻辑，它们在 V44 中已经是正确的。
        // 请确保保留 toggle_user, toggle_ride, add_user, delete, config 逻辑!
        
        // 补全省略的后台逻辑:
        if (url.pathname === '/api/admin/add_user' && method === 'POST') {
            const body = await request.json();
            const newId = 'u_' + Date.now();
            await env.DB.prepare(`INSERT INTO users (id, nickname, phone, balance, status, created_at, last_login) VALUES (?, ?, ?, ?, 1, ?, ?)`).bind(newId, body.nickname, body.phone, Number(body.balance)||0, nowStr, nowStr).run();
            return jsonResponse({ success: true });
        }
        if (url.pathname === '/api/admin/user' && method === 'DELETE') {
            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(url.searchParams.get('id')).run();
            return jsonResponse({ success: true });
        }
        if (url.pathname === '/api/admin/toggle_user' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(body.status, body.id).run();
            return jsonResponse({ success: true });
        }
        if (url.pathname === '/api/admin/toggle_ride' && method === 'POST') {
            const body = await request.json();
            await env.DB.prepare('UPDATE rides SET is_hidden = ? WHERE id = ?').bind(body.hidden, body.id).run();
            return jsonResponse({ success: true });
        }
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
        if (method === 'DELETE' && url.pathname === '/api/rides') {
            await env.DB.prepare('DELETE FROM rides WHERE id = ?').bind(url.searchParams.get('id')).run();
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'API Not Found' }, 404);

    } catch (e) {
        return new Response(JSON.stringify({ error: "Server Error", message: e.message }), { status: 500, headers: corsHeaders });
    }
}
