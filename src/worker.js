/**
 * 宜人出行后端 V4 - 强制授权与全参数管理
 */
export default {
  async fetch(request, env) {
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
    
    const errorResponse = (msg, status = 400) => 
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      // 1. 系统配置 (读写)
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        return jsonResponse(config || {});
      }

      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config' && method === 'POST') {
        const body = await request.json();
        await env.DB.prepare(`
          UPDATE system_config SET 
            platform_name=?, platform_desc=?, platform_logo=?, kefu_wechat=?, official_account_qr=?, 
            notice_text=?, amap_key=?, 
            sms_provider=?, sms_account=?, sms_password=?, sms_template=?, 
            show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, 
            allow_long_term=?, allow_driver_repost=?, allow_passenger_repost=?, about_us=?
          WHERE id = 1
        `).bind(
          body.platform_name, body.platform_desc, body.platform_logo, body.kefu_wechat, body.official_account_qr,
          body.notice_text, body.amap_key,
          body.sms_provider, body.sms_account, body.sms_password, body.sms_template,
          body.show_all_posts?1:0, body.passenger_fee, body.driver_fee, body.driver_cert_required?1:0,
          body.allow_long_term?1:0, body.allow_driver_repost?1:0, body.allow_passenger_repost?1:0, body.about_us
        ).run();
        return jsonResponse({ success: true });
      }

      // 2. 后台管理数据接口
      if (url.pathname === '/api/admin/users' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 50').all();
        return jsonResponse({ results });
      }
      
      if (url.pathname === '/api/admin/all_rides' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY created_at DESC LIMIT 50').all();
        return jsonResponse({ results });
      }

      // 3. 用户登录/授权 (核心)
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        // 插入或更新用户
        await env.DB.prepare(`
          INSERT INTO users (id, nickname, avatar, phone) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            nickname=excluded.nickname, 
            avatar=excluded.avatar, 
            phone=COALESCE(NULLIF(excluded.phone, ''), phone),
            last_login=CURRENT_TIMESTAMP
        `).bind(body.id, body.nickname, body.avatar, body.phone).run();
        
        return jsonResponse({ success: true });
      }

      // 4. 拼车业务
      if (url.pathname === '/api/rides') {
        if (method === 'GET') {
          const type = url.searchParams.get('type');
          let query = 'SELECT * FROM rides WHERE status = 1';
          const params = [];
          if (type && type !== 'all') { query += ' AND type = ?'; params.push(type); }
          query += ' ORDER BY date ASC LIMIT 100';
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ results });
        }

        if (method === 'POST') {
          const data = await request.json();
          // ★ 核心逻辑：检查用户是否已授权(有手机号)
          const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id = ?').bind(data.user_id).first();
          
          if (!user || !user.phone) return errorResponse('须授权手机号后方可发布', 403);
          if (user.status !== 1) return errorResponse('账号异常', 403);

          const result = await env.DB.prepare(`
            INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'').run();
          
          return jsonResponse({ success: true, id: result.meta.last_row_id });
        }

        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
          return jsonResponse({ success: true });
        }
      }

      return errorResponse('API Not Found', 404);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  }
};
