async function md5(string) {
  const msgUint8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Error', { status: 405 });
  try {
    const data = await request.json();
    const config = await env.DB.prepare("SELECT wx_appid FROM system_config LIMIT 1").first();
    
    const out_trade_no = 'RECH' + Date.now();
    const nonce_str = Math.random().toString(36).substring(2, 15);
    const params = {
      appid: config.wx_appid, mch_id: env.WX_MCH_ID, nonce_str: nonce_str,
      body: '宜人出行-余额充值', out_trade_no: out_trade_no,
      total_fee: Math.round(parseFloat(data.amount) * 100),
      spbill_create_ip: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
      notify_url: `https://${new URL(request.url).hostname}/api/wx_notify`,
      trade_type: 'JSAPI', openid: data.openid
    };

    const signStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    params.sign = (await md5(signStr)).toUpperCase();

    const xml = `<xml>${Object.keys(params).map(k => `<${k}>${params[k]}</${k}>`).join('')}</xml>`;
    const response = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', { method: 'POST', body: xml });
    const respText = await response.text();
    
    const prepay_id = respText.match(/<prepay_id><!\[CDATA\[(.*)\]\]><\/prepay_id>/)?.[1] || respText.match(/<prepay_id>(.*)<\/prepay_id>/)?.[1];
    if (!prepay_id) throw new Error('预支付失败');

    const payArgs = { appId: config.wx_appid, timeStamp: Math.floor(Date.now() / 1000).toString(), nonceStr: nonce_str, package: `prepay_id=${prepay_id}`, signType: 'MD5' };
    const paySignStr = Object.keys(payArgs).sort().map(k => `${k}=${payArgs[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    payArgs.paySign = (await md5(paySignStr)).toUpperCase();

    await env.DB.prepare("INSERT INTO orders (id, user_id, amount, type, status) VALUES (?, ?, ?, ?, ?)").bind(out_trade_no, data.user_id, data.amount, 'recharge', 'pending').run();
    return new Response(JSON.stringify({ success: true, payArgs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
