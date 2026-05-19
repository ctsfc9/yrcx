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
      spbill_create_ip: request.headers.get('CF-Connecting-IP') || '127.0.0.1',
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
    
    const prepay_id = xmlRes.match(/<prepay_id><!\[CDATA\[(.*)\]\]><\/prepay_id>/)?.[1] || xmlRes.match(/<prepay_id>(.*)<\/prepay_id>/)?.[1];
    
    // 👉 核心改动：如果没拿到预支付ID，把微信真实的错误原因（err_code_des）提取出来弹窗显示！
    if (!prepay_id) {
        const errMsg = xmlRes.match(/<err_code_des><!\[CDATA\[(.*)\]\]><\/err_code_des>/)?.[1] || xmlRes.substring(0, 100);
        return new Response(JSON.stringify({ error: `微信拦截原因: ${errMsg}` }), { status: 500 });
    }

    const payArgs = { appId: config.wx_appid, timeStamp: Math.floor(Date.now() / 1000).toString(), nonceStr: nonce_str, package: `prepay_id=${prepay_id}`, signType: 'MD5' };
    const paySignStr = Object.keys(payArgs).sort().map(k => `${k}=${payArgs[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    const payHash = await crypto.subtle.digest('MD5', encoder.encode(paySignStr));
    payArgs.paySign = Array.from(new Uint8Array(payHash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    return new Response(JSON.stringify({ success: true, payArgs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
