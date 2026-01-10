/**
 * 宜人出行后端核心逻辑 (Cloudflare Workers + D1)
 * 对应数据库: system_config, rides, users
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    
    // 1. 跨域配置 (CORS) - 允许前端跨域访问
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 处理预检请求 (OPTIONS)
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 辅助函数：统一响应格式
    const jsonResponse = (data, status = 200) => 
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
    const errorResponse = (msg, status = 400) => 
      new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    try {
      // ============================================================
      // 模块一：系统配置管理 (对应后台截图中的参数)
      // ============================================================
      
      // [GET] 获取全局配置 (前端初始化调用)
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'get_config') {
        // 读取数据库配置
        const config = await env.DB.prepare('SELECT * FROM system_config WHERE id = 1').first();
        
        // 默认兜底配置 (防止数据库为空)
        const defaultConfig = {
          platform_name: '宜人出行',
          kefu_wechat: 'keea02',
          notice_text: '欢迎使用宜人出行，数据实时同步 D1 数据库。',
          amap_key: 'a4f6e1e5da68bc9fe5f984d69a3f6b2e',
          show_all_posts: 1,
          passenger_fee: 0,
          driver_fee: 0,
          driver_cert_required: 0
        };

        // 合并数据库配置 (优先使用数据库)
        const finalConfig = { ...defaultConfig, ...config };
        
        // 前端 V27 目前只识别特定字段，做一下映射
        // 数据库字段 platform_desc -> 前端 notice_text
        if (config && config.platform_desc) {
            finalConfig.notice_text = config.platform_desc;
        }

        return jsonResponse(finalConfig);
      }

      // [POST] 保存全局配置 (后台管理员调用)
      if (url.pathname === '/api/admin' && url.searchParams.get('action') === 'save_config' && method === 'POST') {
        const body = await request.json();
        
        // 更新数据库 (这里对应您附件图片中的各项参数)
        await env.DB.prepare(`
          UPDATE system_config SET 
            platform_name = ?, 
            kefu_wechat = ?, 
            amap_key = ?, 
            platform_desc = ?,
            passenger_fee = ?,
            driver_fee = ?,
            driver_cert_required = ?,
            allow_long_term = ?,
            allow_driver_repost = ?
          WHERE id = 1
        `).bind(
          body.platform_name, 
          body.kefu_wechat, 
          body.amap_key, 
          body.notice_text, // 前端传过来的是 notice_text
          body.passenger_fee || 0,
          body.driver_fee || 0,
          body.driver_cert_required ? 1 : 0,
          body.allow_long_term ? 1 : 0,
          body.allow_driver_repost ? 1 : 0
        ).run();

        return jsonResponse({ success: true, message: '配置已更新' });
      }

      // ============================================================
      // 模块二：拼车业务逻辑 (增删改查)
      // ============================================================

      // [GET] 获取拼车列表
      if (url.pathname === '/api/rides' && method === 'GET') {
        const type = url.searchParams.get('type'); // 'driver', 'passenger', 'all'
        
        // 读取系统配置：是否显示过期帖子
        const sysSettings = await env.DB.prepare('SELECT show_all_posts FROM system_config WHERE id = 1').first();
        const showAll = sysSettings ? sysSettings.show_all_posts : 1;

        let query = 'SELECT * FROM rides WHERE status = 1';
        const params = [];

        // 过滤过期帖子逻辑
        if (!showAll) {
           query += " AND date > datetime('now', 'localtime')";
        }

        if (type && type !== 'all') {
          query += ' AND type = ?';
          params.push(type);
        }

        // 排序：置顶优先(is_top desc), 然后按出发时间(date asc)
        query += ' ORDER BY is_top DESC, date ASC LIMIT 100';

        const { results } = await env.DB.prepare(query).bind(...params).all();
        return jsonResponse({ results });
      }

      // [POST] 发布拼车信息
      if (url.pathname === '/api/rides' && method === 'POST') {
        const data = await request.json();
        
        // 1. 业务检查：获取系统配置
        const config = await env.DB.prepare('SELECT driver_cert_required, driver_fee, passenger_fee FROM system_config WHERE id = 1').first();
        
        // 2. 检查司机认证 (如果开启了强制认证)
        if (data.type === 'driver' && config && config.driver_cert_required === 1) {
            const user = await env.DB.prepare('SELECT is_certified FROM users WHERE id = ?').bind(data.user_id).first();
            if (!user || user.is_certified !== 1) {
                return errorResponse('平台要求车主必须实名认证后才能发布', 403);
            }
        }

        // 3. 检查发布费用 (如果开启了收费)
        // 注意：此处仅做逻辑预留，实际支付需要在前端调起支付，成功后带上 pay_token 再调此接口
        // if (data.type === 'driver' && config.driver_fee > 0 && !data.is_paid) { ... }

        // 4. 写入数据库
        const result = await env.DB.prepare(`
          INSERT INTO rides (
            user_id, type, origin, destination, date, seats, price, remark, contact, car_model, is_top, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).bind(
          data.user_id, data.type, data.origin, data.destination, 
          data.date, data.seats, data.price, data.remark, 
          data.contact, data.car_model || '', 0
        ).run();

        // 5. 自动更新用户信息 (如手机号、最近活跃时间)
        await env.DB.prepare(`
            INSERT INTO users (id, phone, nickname, avatar) VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET phone=excluded.phone, nickname=excluded.nickname, avatar=excluded.avatar
        `).bind(data.user_id, data.contact, data.nickname || '用户', data.avatar || '').run();

        return jsonResponse({ success: true, id: result.meta.last_row_id });
      }

      // [DELETE] 删除拼车信息
      if (url.pathname === '/api/rides' && method === 'DELETE') {
        const id = url.searchParams.get('id');
        const userId = url.searchParams.get('user_id'); // 简单的权限校验

        // 如果传了 user_id，则验证是否是本人删除；没传则假设是管理员
        if (userId) {
            const ride = await env.DB.prepare('SELECT user_id FROM rides WHERE id = ?').bind(id).first();
            if (!ride) return errorResponse('信息不存在');
            if (ride.user_id !== userId) return errorResponse('无权删除他人信息', 403);
        }

        // 软删除：status = -1
        await env.DB.prepare('UPDATE rides SET status = -1 WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true });
      }

      // ============================================================
      // 模块三：用户认证 (对应 users 表)
      // ============================================================
      
      // [POST] 用户登录/注册 (目前是静默登录，后续对接微信)
      if (url.pathname === '/api/login' && method === 'POST') {
          const body = await request.json();
          // 这里的逻辑后续对接微信小程序 API
          // 目前仅做简单存储
          return jsonResponse({ 
              token: 'mock-jwt-token-' + Date.now(), 
              user: body 
          });
      }

      return errorResponse('API Not Found', 404);

    } catch (e) {
      return errorResponse('Server Error: ' + e.message, 500);
    }
  }
};
