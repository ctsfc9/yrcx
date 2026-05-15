// 这是一个符合 Cloudflare 环境、无依赖的 MD5 签名与支付申请逻辑
async function md5(string) {
  const msgUint8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const data = await request.json();
    const config = await db.prepare("SELECT wx_appid, amap_key FROM system_config LIMIT 1").first();
    
    // 1. 准备订单基本信息
    const out_trade_no = 'RECH' + Date.now() + Math.floor(Math.random() * 1000);
    const total_fee = Math.round(parseFloat(data.amount) * 100); // 转为分
    const nonce_str = Math.random().toString(36).substring(2, 15);

    // 2. 构造签名参数 (微信 V2 规则)
    const params = {
      appid: config.wx_appid,
      mch_id: env.WX_MCH_ID,
      nonce_str: nonce_str,
      body: '宜人出行-余额充值',
      out_trade_no: out_trade_no,
      total_fee: total_fee,
      spbill_create_ip: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
      notify_url: `https://${new URL(request.url).hostname}/api/wx_notify`,
      trade_type: 'JSAPI',
      openid: data.openid // 必须传入当前用户的openid
    };

    // 3. 字典排序并签名
    const signStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    params.sign = (await md5(signStr)).toUpperCase();

    // 4. 将对象转为 XML 发送给微信 (V2接口)
    const xml = `<xml>${Object.keys(params).map(k => `<${k}>${params[k]}</${k}>`).join('')}</xml>`;
    const response = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', {
      method: 'POST',
      body: xml
    });

    const respText = await response.text();
    // 提取 prepay_id (正则匹配 XML 节点)
    const prepay_id = respText.match(/<prepay_id><!\[CDATA\[(.*)\]\]><\/prepay_id>/)?.[1] || respText.match(/<prepay_id>(.*)<\/prepay_id>/)?.[1];

    if (!prepay_id) return new Response(JSON.stringify({ error: '获取预支付单失败', detail: respText }), { status: 500 });

    // 5. 再次对前端拉起支付的参数进行签名
    const payArgs = {
      appId: config.wx_appid,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: nonce_str,
      package: `prepay_id=${prepay_id}`,
      signType: 'MD5'
    };
    const paySignStr = Object.keys(payArgs).sort().map(k => `${k}=${payArgs[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    payArgs.paySign = (await md5(paySignStr)).toUpperCase();

    // 记录预支付记录
    await db.prepare("INSERT INTO orders (id, user_id, amount, type, status) VALUES (?, ?, ?, ?, ?)")
            .bind(out_trade_no, data.user_id, data.amount, 'recharge', 'pending').run();

    return new Response(JSON.stringify({ success: true, payArgs }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
