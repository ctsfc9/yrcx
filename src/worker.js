/**
 * 宜人出行后端核心 - V3 (全参数配置版)
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
      // ============================================================
      // 1. 配置管理 (对应后台截图的每一个输入框)
      // ============================================================
      
      // [GET] 获取所有配置
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        
        // 兜底默认值
        const safeConfig = config || {
          platform_name: '宜人出行',
          show_all_posts: 1,
          driver_cert_required: 0
        };
        
        // 兼容前端V27的字段名 (前端用 notice_text 显示在首页跑马灯)
        // 我们把 platform_desc (平台描述) 作为公告内容返回
        safeConfig.notice_text = safeConfig.platform_desc || '欢迎使用宜人出行';

        return jsonResponse(safeConfig);
      }

      // [POST] 保存所有配置
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config' && method === 'POST') {
        const body = await request.json();
        
        await env.DB.prepare(`
          UPDATE system_config SET 
            platform_name = ?, platform_desc = ?, kefu_wechat = ?,
            show_all_posts = ?, passenger_fee = ?, driver_fee = ?,
            driver_cert_required = ?, allow_long_term = ?, 
            allow_driver_repost = ?, allow_passenger_repost = ?,
            amap_key = ?, sms_provider = ?, sms_account = ?, sms_password = ?, sms_template = ?,
            about_us = ?
          WHERE id = 1
        `).bind(
          body.platform_name, body.platform_desc, body.kefu_wechat,
          body.show_all_posts ? 1 : 0, body.passenger_fee || 0, body.driver_fee || 0,
          body.driver_cert_required ? 1 : 0, body.allow_long_term ? 1 : 0,
          body.allow_driver_repost ? 1 : 0, body.allow_passenger_repost ? 1 : 0,
          body.amap_key, body.sms_provider, body.sms_account, body.sms_password, body.sms_template,
          body.about_us
        ).run();

        return jsonResponse({ success: true });
      }

      // ============================================================
      // 2. 拼车业务 (深度集成配置参数)
      // ============================================================

      // [GET] 列表 (受 "show_all_posts" 参数控制)
      if (url.pathname === '/api/rides' && method === 'GET') {
        const type = url.searchParams.get('type');
        
        // 1. 先查配置
        const config = await env.DB.prepare('SELECT show_all_posts FROM system_config WHERE id = 1').first();
        const showAll = config ? config.show_all_posts : 1;

        let query = 'SELECT * FROM rides WHERE status = 1';
        const params = [];

        // 2. 如果配置为“只显示有效帖子”，则过滤掉过期时间
        if (showAll === 0) {
           query += " AND date >= datetime('now', 'localtime')";
        }

        if (type && type !== 'all') {
          query += ' AND type = ?';
          params.push(type);
        }

        query += ' ORDER BY date ASC LIMIT 100';
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return jsonResponse({ results });
      }

      // [POST] 发布 (受 "driver_cert_required" 和 "allow_repost" 控制)
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // 1. 获取系统配置
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        
        // 2. 检查：是否允许重复发布
        if (data.type === 'driver' && config.allow_driver_repost === 0) {
            // 查该用户是否有未过期的帖子
            const exist = await env.DB.prepare("SELECT id FROM rides WHERE user_id = ? AND status = 1 AND date > datetime('now')").bind(data.user_id).first();
            if (exist) return errorResponse('平台禁止重复发布，请先完成已有行程', 403);
        }

        // 3. 检查：司机强制认证 (覆盖了之前的手机号检查)
        // 逻辑：只要配了强制认证，就查 is_certified；否则只查手机号
        const user = await env.DB.prepare('SELECT phone, is_certified FROM users WHERE id = ?').bind(data.user_id).first();
        
        if (!user || !user.phone) return errorResponse('请先授权绑定手机号', 403);

        if (data.type === 'driver' && config.driver_cert_required === 1) {
            if (user.is_certified !== 1) return errorResponse('车主须实名认证后方可发布', 403);
        }

        // 4. 入库
        const result = await env.DB.prepare(`
          INSERT INTO rides (
            user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          data.user_id, data.type, data.origin, data.destination, 
          data.date, data.seats, data.price, data.remark, 
          data.contact, data.car_model || ''
        ).run();

        return jsonResponse({ success: true, id: result.meta.last_row_id });
      }

      // [DELETE] 删除
      if (url.pathname === '/api/rides' && method === 'DELETE') {
        const id = url.searchParams.get('id');
        await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true });
      }

      // ============================================================
      // 3. 用户模块 (登录/同步)
      // ============================================================
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        // 这里的逻辑：有则更新，无则插入
        await env.DB.prepare(`
          INSERT INTO users (id, nickname, avatar, phone) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            nickname=excluded.nickname, 
            avatar=excluded.avatar, 
            phone=COALESCE(excluded.phone, phone)
        `).bind(body.id, body.nickname, body.avatar, body.phone).run();
        
        return jsonResponse({ success: true });
      }

      return errorResponse('API Not Found', 404);

    } catch (e) {
      return errorResponse('Internal Error: ' + e.message, 500);
    }
  }
};
