// /api/pay.js
// 这是一个演示如何在 Cloudflare Worker 中构造微信支付 V2 统一下单请求的框架
import md5 from 'md5'; // 假设您通过某种方式引入了轻量级的 md5 库

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === 'POST') {
    try {
      const data = await request.json();
      if (!data.user_id || !data.amount) return new Response('参数错误', { status: 400 });

      // 1. 读取环境变量（绝对安全，不在代码中暴露）
      const MCH_ID = env.WX_MCH_ID;
      const API_KEY = env.WX_API_KEY;
      const APP_ID = env.WX_APP_ID;

      const orderId = 'ORD_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const total_fee = Math.round(parseFloat(data.amount) * 100); // 微信支付单位为“分”

      // 2. 构造微信统一下单参数
      const params = {
        appid: APP_ID,
        mch_id: MCH_ID,
        nonce_str: Math.random().toString(36).substring(2, 15),
        body: '宜人出行-余额充值',
        out_trade_no: orderId,
        total_fee: total_fee,
        spbill_create_ip: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
        notify_url: 'https://您的域名.com/api/wx_notify', // 必须是外网能访问的真实回调地址
        trade_type: 'JSAPI', // 如果在微信内使用 JSAPI，如果在普通浏览器使用 H5 (MWEB)
        openid: data.openid // JSAPI 必须传入用户的 OpenID
      };

      // 3. 字典排序并生成 MD5 签名 (非常严格的微信规则)
      const sortedKeys = Object.keys(params).sort();
      let signString = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
      signString += `&key=${API_KEY}`;
      params.sign = md5(signString).toUpperCase(); // 这里需要您打包时引入 md5 依赖

      // 4. 将 JSON 转为 XML 并向微信发请求 (微信 V2 接口只认 XML)
      // ... 构建 XML 字符串 ...
      // const wxResponse = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', { method: 'POST', body: xmlData });
      // ... 解析微信返回的 XML 拿到 prepay_id ...

      // 5. 订单状态写入数据库为 'pending' (待支付)
      await db.prepare("INSERT INTO orders (id, user_id, amount, type, status) VALUES (?, ?, ?, ?, ?)").bind(orderId, data.user_id, data.amount, 'recharge', 'pending').run();

      // 6. 返回给前端唤起支付所需的参数
      return new Response(JSON.stringify({ 
        success: true, 
        // prepay_id: ...
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
      return new Response(JSON.stringify({ error: '系统异常' }), { status: 500 });
    }
  }
}
