export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Error', { status: 405 });
  
  // 【硬编码注入】直接写死，彻底杜绝读不到环境变量的问题
  const WX_MCH_ID = '1515306371';
  const WX_API_KEY = '00134EC6DEC4E7678EBD20E10C16911F';

  try {
    const data = await request.json();
    const config = await env.DB.prepare("SELECT wx_appid FROM system_config LIMIT 1").first();
    
    const out_trade_no = 'RECH' + Date.now();
    const nonce_str = Math.random().toString(36).substring(2, 15);
    
    const params = {
      appid: config.wx_appid,
      mch_id: WX_MCH_ID, // 硬编码注入
      nonce_str: nonce_str,
      body: '宜人出行充值',
      out_trade_no: out_trade_no,
      total_fee: Math.round(parseFloat(data.amount) * 100),
      spbill_create_ip: '127.0.0.1',
      notify_url: `https://${new URL(request.url).hostname}/api/wx_notify`,
      trade_type: 'JSAPI',
      openid: data.openid
    };

    // 签名逻辑
    const signStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + `&key=${WX_API_KEY}`;
    const encoder = new TextEncoder();
    const dataUint8 = encoder.encode(signStr);
    const hashBuffer = await crypto.subtle.digest('MD5', dataUint8);
    params.sign = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const xml = `<xml>${Object.keys(params).map(k => `<${k}>${params[k]}</${k}>`).join('')}</xml>`;
    const response = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', { method: 'POST', body: xml });
    const respText = await response.text();
    
    if (!respText.includes('<prepay_id>')) {
        return new Response(JSON.stringify({ error: '微信拦截:' + respText.substring(0, 50) }), { status: 500 });
    }

    const prepay_id = respText.match(/<prepay_id><!\[CDATA\[(.*)\]\]><\/prepay_id>/)?.[1] || respText.match(/<prepay_id>(.*)<\/prepay_id>/)?.[1];
    
    const payArgs = { appId: config.wx_appid, timeStamp: Math.floor(Date.now() / 1000).toString(), nonceStr: nonce_str, package: `prepay_id=${prepay_id}`, signType: 'MD5' };
    const paySignStr = Object.keys(payArgs).sort().map(k => `${k}=${payArgs[k]}`).join('&') + `&key=${WX_API_KEY}`;
    const paySignBuffer = await crypto.subtle.digest('MD5', encoder.encode(paySignStr));
    payArgs.paySign = Array.from(new Uint8Array(paySignBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    return new Response(JSON.stringify({ success: true, payArgs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
