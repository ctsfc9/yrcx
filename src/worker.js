/**
 * 宜人出行后端 V5 - 参数托管与用户入库修复版
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
    
    try {
      // 1. 获取配置 (前端瘦身核心)
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        // 确保字段存在，防止前端 undefined
        const safeConfig = config || {};
        return jsonResponse(safeConfig);
      }

      // 2. 保存配置 (支持新字段)
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config' && method === 'POST') {
        const body = await request.json();
        await env.DB.prepare(`
          UPDATE system_config SET 
            platform_name=?, platform_desc=?, kefu_wechat=?, notice_text=?,
            banners=?, tags_driver=?, tags_passenger=?, 
            amap_key=?, sms_account=?, sms_password=?, 
            show_all_posts=?, passenger_fee=?, driver_fee=?, driver_cert_required=?, allow_driver_repost=?
          WHERE id = 1
        `).bind(
          body.platform_name, body.platform_desc, body.kefu_wechat, body.notice_text,
          body.banners, body.tags_driver, body.tags_passenger, // 新增字段保存
          body.amap_key, body.sms_account, body.sms_password,
          body.show_all_posts?1:0, body.passenger_fee, body.driver_fee, body.driver_cert_required?1:0, body.allow_driver_repost?1:0
        ).run();
        return jsonResponse({ success: true });
      }

      // 3. 用户登录/数据同步 (修复版：先查后写)
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        if (!body.id) return new Response('Missing ID', { status: 400, headers: corsHeaders });

        // 检查用户是否存在
        const exist = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();
        
        if (exist) {
            // 更新
            await env.DB.prepare(`
                UPDATE users SET nickname=?, avatar=?, phone=?, last_login=CURRENT_TIMESTAMP WHERE id=?
            `).bind(body.nickname, body.avatar, body.phone, body.id).run();
        } else {
            // 插入
            await env.DB.prepare(`
                INSERT INTO users (id, nickname, avatar, phone) VALUES (?, ?, ?, ?)
            `).bind(body.id, body.nickname, body.avatar, body.phone).run();
        }
        return jsonResponse({ success: true });
      }

      // 4. 后台数据接口
      if (url.pathname === '/api/admin/users') {
        const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 50').all();
        return jsonResponse({ results });
      }
      if (url.pathname === '/api/admin/all_rides') {
        const { results } = await env.DB.prepare('SELECT * FROM rides ORDER BY created_at DESC LIMIT 50').all();
        return jsonResponse({ results });
      }

      // 5. 拼车业务
      if (url.pathname === '/api/rides') {
        if (method === 'GET') {
            const type = url.searchParams.get('type');
            let q = 'SELECT * FROM rides WHERE status = 1';
            const p = [];
            // 获取配置判断是否显示过期
            const conf = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
            if (conf && !conf.show_all_posts) q += " AND date > datetime('now')";
            
            if (type && type !== 'all') { q += ' AND type = ?'; p.push(type); }
            q += ' ORDER BY date ASC LIMIT 100';
            const { results } = await env.DB.prepare(q).bind(...p).all();
            return jsonResponse({ results });
        }
        if (method === 'POST') {
            const data = await request.json();
            // 强制校验手机号
            const u = await env.DB.prepare('SELECT phone, status FROM users WHERE id=?').bind(data.user_id).first();
            if (!u || !u.phone) return new Response(JSON.stringify({ error: '请先绑定手机号' }), { status: 403, headers: corsHeaders });
            
            const res = await env.DB.prepare(`INSERT INTO rides (user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status) VALUES (?,?,?,?,?,?,?,?,?,?,1)`).bind(data.user_id, data.type, data.origin, data.destination, data.date, data.seats, data.price, data.remark, data.contact, data.car_model||'').run();
            return jsonResponse({ success: true, id: res.meta.last_row_id });
        }
        if (method === 'DELETE') {
            await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(url.searchParams.get('id')).run();
            return jsonResponse({ success: true });
        }
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
  }
};
