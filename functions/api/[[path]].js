/**
 * Cloudflare Pages Functions 后端逻辑 - V38 修复版
 * 修复目标：解决 table users has no column named balance
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const method = request.method;

    // 1. 跨域配置
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const jsonResponse = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
        // 检查数据库绑定
        if (!env.DB) throw new Error("D1 database not bound");

        const nowStr = new Date().toISOString();

        // ===========================================
        // 1. 用户登录 (对应 users 表)
        // ===========================================
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            if (!body.id) return jsonResponse({ error: 'User ID Missing' }, 400);

            // 1. 先查询
            const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();

            if (existing) {
                // 2. 存在则更新 (不更新 balance，防止覆盖余额)
                await env.DB.prepare(`
                    UPDATE users SET 
                        nickname = ?, 
                        avatar = ?, 
                        phone = ?, 
                        last_login = ? 
                    WHERE id = ?
                `).bind(
                    body.nickname || '', 
                    body.avatar || '', 
                    body.phone || '', 
                    nowStr, 
                    body.id
                ).run();
            } else {
                // 3. 不存在则插入 (这里必须包含 balance 字段，且 SQL 必须有对应列)
                // 数据库报错就是因为这里写了 balance，但表里没有
                await env.DB.prepare(`
                    INSERT INTO users (id, nickname, avatar, phone, balance, status, created_at, last_login) 
                    VALUES (?, ?, ?, ?, 0, 1, ?, ?)
                `).bind(
                    body.id, 
                    body.nickname || '新用户', 
                    body.avatar || '', 
                    body.phone || '', 
                    // balance 默认为 0
                    // status 默认为 1
                    nowStr, 
                    nowStr
                ).run();
            }
            return jsonResponse({ success: true, msg: 'User Synced' });
        }

        // ===========================================
        // 2. 发布拼车 (对应 rides 表)
        // ===========================================
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            
            // 验证手机号
            const user = await env.DB.prepare('SELECT phone FROM users WHERE id = ?').bind(data.user_id).first();
            if (!user || !user.phone) return jsonResponse({ error: '请先绑定手机号' }, 403);

            const res = await env.DB.prepare(`
                INSERT INTO rides (
                    user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            `).bind(
                data.user_id, data.type, data.origin, data.destination, data.date, 
                data.seats, data.price, data.remark, data.contact, data.car_model || '', nowStr
            ).run();

            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }

        // ===========================================
        // 3. 读取列表
        // ===========================================
        if (url.pathname === '/api/rides' && method === 'GET') {
            const { results } = await env.DB.prepare('SELECT * FROM rides WHERE status = 1 ORDER BY created_at DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }

        if (url.pathname === '/api/admin/users') {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }

        if (url.pathname === '/api/admin/all_rides') {
            const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY created_at DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }

        // ===========================================
        // 4. 配置管理
        // ===========================================
        if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
            const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
            return jsonResponse(config || {});
        }

        if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config') {
            const body = await request.json();
            await env.DB.prepare(`
                UPDATE system_config SET 
                platform_name=?, platform_desc=?, kefu_wechat=?, notice_text=?, banners=?,
                tags_driver=?, tags_passenger=?, amap_key=?, 
                show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, allow_driver_repost=?
                WHERE id=1
            `).bind(
                body.platform_name, body.platform_desc, body.kefu_wechat, body.notice_text, body.banners,
                body.tags_driver, body.tags_passenger, body.amap_key,
                body.show_all_posts?1:0, body.passenger_fee, body.driver_fee, body.driver_cert_required?1:0, body.allow_driver_repost?1:0
            ).run();
            return jsonResponse({ success: true });
        }

        if (method === 'DELETE') {
            const id = url.searchParams.get('id');
            await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'Not Found' }, 404);

    } catch (e) {
        // 返回详细错误供前端调试
        return new Response(JSON.stringify({ 
            error: "Pages Function Error", 
            message: e.message, // 这里会显示具体的 SQL 错误
            stack: e.stack
        }), { status: 500, headers: corsHeaders });
    }
}
