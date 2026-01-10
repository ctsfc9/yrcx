/**
 * V39 智能容错版 - 自动适应数据库结构
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
        if (!env.DB) throw new Error("D1 Database Not Bound");
        const nowStr = new Date().toISOString();

        // ===========================================
        // 1. 智能用户登录 (自动降级)
        // ===========================================
        if (url.pathname === '/api/login' && method === 'POST') {
            const body = await request.json();
            if (!body.id) return jsonResponse({ error: 'User ID Missing' }, 400);

            // 1. 检查用户是否存在
            const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();

            if (existing) {
                // 更新：只更新最基础字段，不碰 balance，防止报错
                await env.DB.prepare(`
                    UPDATE users SET nickname=?, avatar=?, phone=?, last_login=? WHERE id=?
                `).bind(body.nickname, body.avatar, body.phone, nowStr, body.id).run();
            } else {
                // 插入：尝试写入完整字段，如果失败则尝试“降级写入”
                try {
                    await env.DB.prepare(`
                        INSERT INTO users (id, nickname, avatar, phone, balance, status, created_at, last_login) 
                        VALUES (?, ?, ?, ?, 0, 1, ?, ?)
                    `).bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
                } catch (insertError) {
                    // ★★★ 核心容错：如果因为 balance 列不存在而报错，则执行老版本插入 ★★★
                    if (insertError.message.includes('no column')) {
                        console.warn("Database mismatch, falling back to basic insert");
                        await env.DB.prepare(`
                            INSERT INTO users (id, nickname, avatar, phone, created_at, last_login) 
                            VALUES (?, ?, ?, ?, ?, ?)
                        `).bind(body.id, body.nickname, body.avatar, body.phone, nowStr, nowStr).run();
                    } else {
                        throw insertError; // 其他错误照常抛出
                    }
                }
            }
            return jsonResponse({ success: true, msg: 'Synced' });
        }

        // ===========================================
        // 2. 智能发布拼车
        // ===========================================
        if (url.pathname === '/api/rides' && method === 'POST') {
            const data = await request.json();
            
            // 验证手机号
            const user = await env.DB.prepare('SELECT phone FROM users WHERE id = ?').bind(data.user_id).first();
            if (!user || !user.phone) return jsonResponse({ error: '请先绑定手机号' }, 403);

            // 同样尝试带 created_at 写入，失败则降级
            try {
                const res = await env.DB.prepare(`
                    INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                `).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'', nowStr).run();
                return jsonResponse({ success: true, id: res.meta.last_row_id });
            } catch (e) {
                // 降级：不写 created_at
                const res = await env.DB.prepare(`
                    INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                `).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'').run();
                return jsonResponse({ success: true, id: res.meta.last_row_id });
            }
        }

        // ===========================================
        // 3. 读取接口 (保持不变)
        // ===========================================
        if (url.pathname === '/api/rides' && method === 'GET') {
            const { results } = await env.DB.prepare('SELECT * FROM rides WHERE status = 1 ORDER BY id DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }
        if (url.pathname === '/api/admin/users') {
            const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }
        if (url.pathname === '/api/admin/all_rides') {
            const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY id DESC LIMIT 50').all();
            return jsonResponse({ results: results || [] });
        }

        // ===========================================
        // 4. 配置接口
        // ===========================================
        if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
            const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
            return jsonResponse(config || {});
        }
        if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config') {
            const body = await request.json();
            // 简单更新，防止字段报错
            await env.DB.prepare(`UPDATE system_config SET platform_name=?, notice_text=?, show_all_posts=? WHERE id=1`)
               .bind(body.platform_name, body.notice_text, body.show_all_posts?1:0).run();
            return jsonResponse({ success: true });
        }

        // 删除
        if (method === 'DELETE') {
            await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(url.searchParams.get('id')).run();
            return jsonResponse({ success: true });
        }

        return jsonResponse({ error: 'API Not Found' }, 404);

    } catch (e) {
        return new Response(JSON.stringify({ 
            error: "Pages Error", 
            message: e.message 
        }), { status: 500, headers: corsHeaders });
    }
}
