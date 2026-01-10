export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    
    // CORS 配置
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const jsonResponse = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const errorResponse = (msg, status = 400) => 
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      // ============================================================
      // 1. 用户授权与绑定 (新接口)
      // ============================================================
      if (url.pathname === '/api/user/bind' && method === 'POST') {
        const data = await request.json();
        // data 包含: id, nickname, avatar, phone
        
        if (!data.phone || !data.avatar) {
            return errorResponse('必须授权微信头像并绑定手机号');
        }

        // 插入或更新用户信息
        await env.DB.prepare(`
          INSERT INTO users (id, nickname, avatar, phone, last_login_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET 
            nickname = excluded.nickname,
            avatar = excluded.avatar,
            phone = excluded.phone,
            last_login_at = excluded.last_login_at
        `).bind(data.id, data.nickname, data.avatar, data.phone).run();

        return jsonResponse({ success: true });
      }

      // ============================================================
      // 2. 发布拼车 (逻辑简化：只查手机号)
      // ============================================================
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // ★★★ 核心校验：查用户是否存在且资料完整 ★★★
        const user = await env.DB.prepare('SELECT phone, avatar, status FROM users WHERE id = ?').bind(data.user_id).first();
        
        if (!user) return errorResponse('用户未注册，请刷新页面重新授权', 401);
        if (user.status === 0) return errorResponse('账号已被封禁', 403);
        if (!user.phone || !user.avatar) return errorResponse('请先完成微信授权和手机号绑定', 403);

        // 写入拼车表
        const result = await env.DB.prepare(`
          INSERT INTO rides (
            user_id, type, origin, destination, date, seats, price, remark, contact, car_model, is_top, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          data.user_id, data.type, data.origin, data.destination, 
          data.date, data.seats, data.price, data.remark, 
          user.phone, // 强制使用绑定手机号
          data.car_model || '', 0
        ).run();

        return jsonResponse({ success: true });
      }

      // ============================================================
      // 3. 获取配置 (保持不变)
      // ============================================================
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        const defaultConfig = {
          platform_name: '宜人出行', kefu_wechat: 'keea02', notice_text: '欢迎使用', amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e'
        };
        return jsonResponse({ ...defaultConfig, ...config });
      }

      // ============================================================
      // 4. 获取列表 (保持不变)
      // ============================================================
      if (url.pathname === '/api/rides' && method === 'GET') {
        const type = url.searchParams.get('type');
        let query = 'SELECT * FROM rides WHERE status = 1';
        // 过滤过期 (可选)
        // query += " AND date > datetime('now')"; 
        if (type && type !== 'all') query += ` AND type = '${type}'`;
        query += ' ORDER BY date ASC LIMIT 100';
        
        const { results } = await env.DB.prepare(query).all();
        return jsonResponse({ results });
      }
      
      // ============================================================
      // 5. 删除 (保持不变)
      // ============================================================
      if (url.pathname === '/api/rides' && method === 'DELETE') {
          const id = url.searchParams.get('id');
          await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
          return jsonResponse({ success: true });
      }

      return errorResponse('Not Found', 404);

    } catch (e) {
      return errorResponse('Server Error: ' + e.message, 500);
    }
  }
};
