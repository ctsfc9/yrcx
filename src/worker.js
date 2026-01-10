/**
 * 宜人出行后端 V32 - 修复保存与发布BUG
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
      // ====================================================
      // 1. 系统配置模块 (修复保存功能)
      // ====================================================
      
      // [GET] 获取配置
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        return jsonResponse(config || {});
      }

      // [POST] 保存配置 (★修复：字段一一对应)
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config' && method === 'POST') {
        const body = await request.json();
        
        await env.DB.prepare(`
          UPDATE system_config SET 
            platform_name=?, platform_desc=?, platform_logo=?, kefu_wechat=?, official_account_qr=?, notice_text=?, 
            banners=?, tags_driver=?, tags_passenger=?, 
            amap_key=?, sms_provider=?, sms_account=?, sms_password=?, sms_template=?, 
            show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, 
            allow_long_term=?, allow_driver_repost=?, allow_passenger_repost=?, about_us=?
          WHERE id = 1
        `).bind(
          body.platform_name, body.platform_desc, body.platform_logo, body.kefu_wechat, body.official_account_qr, body.notice_text,
          body.banners, body.tags_driver, body.tags_passenger,
          body.amap_key, body.sms_provider, body.sms_account, body.sms_password, body.sms_template,
          body.show_all_posts?1:0, body.passenger_fee, body.driver_fee, body.driver_cert_required?1:0,
          body.allow_long_term?1:0, body.allow_driver_repost?1:0, body.allow_passenger_repost?1:0, body.about_us
        ).run();

        return jsonResponse({ success: true });
      }

      // ====================================================
      // 2. 拼车业务模块 (修复标签报错)
      // ====================================================

      // [GET] 列表
      if (url.pathname === '/api/rides' && method === 'GET') {
        const type = url.searchParams.get('type');
        let q = 'SELECT * FROM rides WHERE status = 1';
        const p = [];
        
        // 读取配置判断是否显示过期
        const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
        if (conf && !conf.show_all_posts) {
             q += " AND date > datetime('now', 'localtime')";
        }

        if (type && type !== 'all') { q += ' AND type = ?'; p.push(type); }
        
        q += ' ORDER BY created_at DESC LIMIT 100'; // 按发布时间倒序
        const { results } = await env.DB.prepare(q).bind(...p).all();
        return jsonResponse({ results: results || [] });
      }

      // [POST] 发布 (★修复：备注字段处理)
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // 1. 检查用户
        const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id = ?').bind(data.user_id).first();
        if (!user || !user.phone) return errorResponse('请先授权手机号', 403);
        if (user.status !== 1) return errorResponse('账号异常', 403);

        // 2. 处理数据 (防报错)
        const remarkStr = Array.isArray(data.remark) ? data.remark.join('，') : (data.remark || '');
        
        // 3. 写入
        const result = await env.DB.prepare(`
          INSERT INTO rides (
            user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          data.user_id, data.type, data.origin, data.destination, 
          data.date, data.seats, data.price, remarkStr, // 这里传入处理好的字符串
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

      // ====================================================
      // 3. 用户与后台模块 (修复数据不显示)
      // ====================================================

      // [POST] 用户登录 (★修复：使用 UPSERT 语法)
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        if (!body.id) return errorResponse('ID Required');

        // 先尝试更新，如果影响行数为0则插入
        const update = await env.DB.prepare(`
            UPDATE users SET nickname=?, avatar=?, phone=?, last_login=CURRENT_TIMESTAMP WHERE id=?
        `).bind(body.nickname, body.avatar, body.phone, body.id).run();

        if (update.meta.changes === 0) {
            await env.DB.prepare(`
                INSERT INTO users (id, nickname, avatar, phone) VALUES (?, ?, ?, ?)
            `).bind(body.id, body.nickname, body.avatar, body.phone).run();
        }
        
        return jsonResponse({ success: true });
      }

      // [GET] 后台用户列表
      if (url.pathname === '/api/admin/users') {
        const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
        return jsonResponse({ results: results || [] });
      }

      // [GET] 后台拼车列表
      if (url.pathname === '/api/admin/all_rides') {
        const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY created_at DESC LIMIT 100').all();
        return jsonResponse({ results: results || [] });
      }

      return errorResponse('Not Found', 404);
    } catch (e) {
      return errorResponse('Server Error: ' + e.message, 500);
    }
  }
};
