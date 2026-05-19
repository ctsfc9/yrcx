export async function onRequest(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const config = await env.DB.prepare("SELECT wx_appid FROM system_config LIMIT 1").first();
    const nonce_str = Math.random().toString(36).substring(2, 15);
    const out_trade_no = 'RECH' + Date.now();
    
    const params = {
      appid: config.wx_appid,
      mch_id: env.WX_MCH_ID,
      nonce_str: nonce_str,
      body: '宜人出行充值',
      out_trade_no: out_trade_no,
      total_fee: Math.round(parseFloat(data.amount) * 100),
      spbill_create_ip: '127.0.0.1',
      notify_url: `https://${new URL(request.url).hostname}/api/wx_notify`,
      trade_type: 'JSAPI',
      openid: data.openid
    };

    const signStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('MD5', encoder.encode(signStr));
    params.sign = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const xml = `<xml>${Object.keys(params).map(k => `<${k}><![CDATA[${params[k]}]]></${k}>`).join('')}</xml>`;
    const response = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', { method: 'POST', body: xml });
    const xmlRes = await response.text();
    
    const prepay_id = xmlRes.match(/<prepay_id><!\[CDATA\[(.*)\]\]><\/prepay_id>/)?.[1];
    if (!prepay_id) return new Response(JSON.stringify({ error: 'FAILED' }), { status: 500 });

    const payArgs = { appId: config.wx_appid, timeStamp: Math.floor(Date.now() / 1000).toString(), nonceStr: nonce_str, package: `prepay_id=${prepay_id}`, signType: 'MD5' };
    const paySignStr = Object.keys(payArgs).sort().map(k => `${k}=${payArgs[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    const payHash = await crypto.subtle.digest('MD5', encoder.encode(paySignStr));
    payArgs.paySign = Array.from(new Uint8Array(payHash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    return new Response(JSON.stringify({ success: true, payArgs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
