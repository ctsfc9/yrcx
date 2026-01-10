/**
 * 宜人出行后端核心逻辑 - V2 (微信授权+手机号强制绑定版)
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const jsonResponse = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    const errorResponse = (msg, status = 400) => 
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      // ============================================================
      // 模块一：用户认证与授权 (核心门槛)
      // ============================================================
      
      // [POST] 用户登录/同步信息
      // 前端在获取到微信头像/昵称或绑定手机号后调用此接口
      if (url.pathname === '/api/login' && method === 'POST') {
        const body = await request.json();
        const { id, nickname, avatar, phone } = body;

        if (!id) return errorResponse('User ID is required');

        // 检查用户是否存在
        const existingUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();

        if (existingUser) {
          // 更新现有用户信息 (如果前端传了新值)
          await env.DB.prepare(`
            UPDATE users SET 
              nickname = COALESCE(?, nickname),
              avatar = COALESCE(?, avatar),
              phone = COALESCE(?, phone),
              last_login = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(nickname, avatar, phone, id).run();
        } else {
          // 创建新用户
          await env.DB.prepare(`
            INSERT INTO users (id, nickname, avatar, phone) VALUES (?, ?, ?, ?)
          `).bind(id, nickname || '新用户', avatar || '', phone || '').run();
        }

        // 返回最新用户信息
        const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
        return jsonResponse({ success: true, user: updatedUser });
      }

      // [GET] 获取用户信息 (用于检查是否已绑定手机)
      if (url.pathname === '/api/user' && method === 'GET') {
        const userId = url.searchParams.get('id');
        if (!userId) return errorResponse('Missing ID');
        
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        return jsonResponse(user || {});
      }

      // ============================================================
      // 模块二：系统配置 (后台管理)
      // ============================================================
      
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        
        const safeConfig = config || {
          platform_name: '宜人出行',
          kefu_wechat: 'keea02',
          notice_text: '欢迎使用宜人出行',
          amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
          show_all_posts: 1
        };

        // 映射前端字段
        const frontendConfig = {
          ...safeConfig,
          notice_text: safeConfig.notice_text
        };

        return jsonResponse(frontendConfig);
      }

      // [POST] 保存配置
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config' && method === 'POST') {
        const body = await request.json();
        
        await env.DB.prepare(`
          UPDATE system_config SET 
            platform_name = ?, 
            kefu_wechat = ?, 
            amap_key = ?, 
            notice_text = ?,
            passenger_fee = ?,
            driver_fee = ?
          WHERE id = 1
        `).bind(
          body.platform_name, 
          body.kefu_wechat, 
          body.amap_key, 
          body.notice_text, 
          body.passenger_fee || 0,
          body.driver_fee || 0
        ).run();

        return jsonResponse({ success: true });
      }

      // ============================================================
      // 模块三：拼车业务逻辑 (已移除复杂的司机认证)
      // ============================================================

      // [GET] 列表
      if (url.pathname === '/api/rides' && method === 'GET') {
        const type = url.searchParams.get('type'); 
        let query = 'SELECT * FROM rides WHERE status = 1';
        const params = [];

        // 默认过滤掉已过期的时间 (可选，根据 show_all_posts 控制)
        // const sys = await env.DB.prepare('SELECT show_all_posts FROM system_config').first();
        // if (!sys.show_all_posts) query += " AND date > datetime('now')";

        if (type && type !== 'all') {
          query += ' AND type = ?';
          params.push(type);
        }

        // 排序：日期升序
        query += ' ORDER BY date ASC LIMIT 100';

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return jsonResponse({ results });
      }

      // [POST] 发布 (关键修改：只检查手机号)
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // 1. 强制检查：用户是否存在且有手机号
        const user = await env.DB.prepare('SELECT phone, status FROM users WHERE id = ?').bind(data.user_id).first();
        
        if (!user) {
            return errorResponse('用户不存在，请重新登录', 401);
        }
        
        if (user.status !== 1) {
            return errorResponse('账号已被封禁', 403);
        }

        // ★★★ 核心逻辑：只要有手机号，就可以发布，无需其他认证 ★★★
        if (!user.phone || user.phone.length < 11) {
            return errorResponse('必须授权手机号才能发布行程', 403); 
            // 前端收到 403 应弹出绑定手机窗口
        }

        // 2. 写入数据
        const result = await env.DB.prepare(`
          INSERT INTO rides (
            user_id, type, origin, destination, date, seats, price, remark, contact, car_model, is_top, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          data.user_id, data.type, data.origin, data.destination, 
          data.date, data.seats, data.price, data.remark, 
          data.contact, data.car_model || '', 0
        ).run();

        return jsonResponse({ success: true, id: result.meta.last_row_id });
      }

      // [DELETE] 删除
      if (url.pathname === '/api/rides' && method === 'DELETE') {
        const id = url.searchParams.get('id');
        const userId = url.searchParams.get('user_id');

        // 验证权限
        if (userId) {
            const ride = await env.DB.prepare('SELECT user_id FROM rides WHERE id = ?').bind(id).first();
            if (!ride) return errorResponse('信息不存在');
            if (ride.user_id !== userId) return errorResponse('无权删除', 403);
        }

        await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true });
      }

      // ============================================================
      // 模块四：后台数据统计 (对应截图)
      // ============================================================
      
      // [GET] 后台获取用户列表
      if (url.pathname === '/api/admin/users' && method === 'GET') {
          // 这里可以加简单的 admin_token 验证
          const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 50').all();
          return jsonResponse({ results });
      }

      return errorResponse('API Not Found', 404);

    } catch (e) {
      return errorResponse('Server Error: ' + e.message, 500);
    }
  }
};
