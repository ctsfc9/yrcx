/**
 * V33 后端 - 稳健数据写入版
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
      // ===========================================
      // 1. 用户登录/同步 (最关键的修复)
      // ===========================================
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        console.log('收到登录请求:', body); // 调试日志

        if (!body.id) return new Response('User ID Missing', { status: 400, headers: corsHeaders });

        // 第一步：先查用户是否存在
        const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.id).first();

        if (existing) {
            // 存在 -> 执行更新
            await env.DB.prepare(`
                UPDATE users SET 
                    nickname = ?, 
                    avatar = ?, 
                    phone = ?, 
                    last_login = datetime('now', 'localtime') 
                WHERE id = ?
            `).bind(body.nickname || '未知', body.avatar || '', body.phone || '', body.id).run();
        } else {
            // 不存在 -> 执行插入
            await env.DB.prepare(`
                INSERT INTO users (id, nickname, avatar, phone, created_at, last_login) 
                VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
            `).bind(body.id, body.nickname || '新用户', body.avatar || '', body.phone || '').run();
        }

        return jsonResponse({ success: true, msg: '用户数据已同步' });
      }

      // ===========================================
      // 2. 发布拼车 (修复无数据问题)
      // ===========================================
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // 确保备注是字符串
        const remarkStr = Array.isArray(data.remark) ? data.remark.join(',') : (data.remark || '');

        // 强行写入，不依赖复杂的检查逻辑，先确保能写进去
        const res = await env.DB.prepare(`
            INSERT INTO rides (
                user_id, type, origin, destination, date, seats, price, remark, contact, car_model, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now', 'localtime'))
        `).bind(
            data.user_id, 
            data.type, 
            data.origin, 
            data.destination, 
            data.date, 
            data.seats, 
            data.price, 
            remarkStr, 
            data.contact, 
            data.car_model || ''
        ).run();

        return jsonResponse({ success: true, id: res.meta.last_row_id });
      }

      // ===========================================
      // 3. 获取列表 (前端首页 & 后台)
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

      // 4. 配置获取
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
         const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
         return jsonResponse(config || {});
      }
      
      // 5. 配置保存
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config') {
         const body = await request.json();
         // 简化更新，防止 SQL 错误
         await env.DB.prepare(`UPDATE system_config SET platform_name=?, notice_text=?, banners=?, show_all_posts=?, passenger_fee=?, driver_fee=? WHERE id=1`)
            .bind(body.platform_name, body.notice_text, body.banners, body.show_all_posts?1:0, body.passenger_fee, body.driver_fee).run();
         return jsonResponse({ success: true });
      }

      // 6. 删除
      if (method === 'DELETE') {
         const id = url.searchParams.get('id');
         await env.DB.prepare('DELETE FROM rides WHERE id = ?').bind(id).run(); // 直接物理删除测试
         return jsonResponse({ success: true });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (e) {
      // ★★★ 关键：返回具体错误信息给前端 ★★★
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers: corsHeaders });
    }
  }
};
