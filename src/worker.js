/**
 * V35 稳健后端 - 修复数据库写入错误
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    
    // 1. CORS 允许跨域
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // 2. 根路径检查 (解决后台打开变首页问题)
    if (url.pathname === '/' || url.pathname === '') {
        return new Response("Backend API is Running. Use /api/...", { headers: corsHeaders });
    }

    const jsonResponse = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      // 获取当前时间字符串 (YYYY-MM-DD HH:mm:ss)
      const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

      // ===========================
      // 用户登录 (修复写入失败)
      // ===========================
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        if (!body.id) throw new Error("User ID Missing");

        // 1. 查
        const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();

        if (existing) {
            // 2. 改 (使用 JS 时间字符串)
            await env.DB.prepare(`
                UPDATE users SET 
                    nickname = ?, avatar = ?, phone = ?, last_login = ? 
                WHERE id = ?
            `).bind(
                body.nickname || '', 
                body.avatar || '', 
                body.phone || '', 
                nowStr, 
                body.id
            ).run();
        } else {
            // 3. 增 (使用 JS 时间字符串)
            await env.DB.prepare(`
                INSERT INTO users (id, nickname, avatar, phone, balance, status, created_at, last_login) 
                VALUES (?, ?, ?, ?, 0, 1, ?, ?)
            `).bind(
                body.id, 
                body.nickname || '新用户', 
                body.avatar || '', 
                body.phone || '', 
                nowStr, 
                nowStr
            ).run();
        }
        return jsonResponse({ success: true });
      }

      // ===========================
      // 拼车发布
      // ===========================
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // 验证用户
        const user = await env.DB.prepare('SELECT phone FROM users WHERE id = ?').bind(data.user_id).first();
        if (!user || !user.phone) {
            return jsonResponse({ error: '请先绑定手机号' }, 403);
        }

        const res = await env.DB.prepare(`
            INSERT INTO rides (
                user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(
            data.user_id, data.type, data.origin, data.destination, data.date, 
            data.seats, data.price, data.remark, data.contact, data.car_model || '', 
            nowStr
        ).run();

        return jsonResponse({ success: true, id: res.meta.last_row_id });
      }

      // ===========================
      // 读取接口
      // ===========================
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

      // ===========================
      // 配置接口
      // ===========================
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

      return new Response('Not Found: ' + url.pathname, { status: 404, headers: corsHeaders });

    } catch (e) {
      // 返回详细的数据库错误信息
      return new Response(JSON.stringify({ 
          error: "Database Error", 
          details: e.message 
      }), { status: 500, headers: corsHeaders });
    }
  }
};
