export async function onRequest(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const config = await env.DB.prepare("SELECT wx_appid FROM system_config LIMIT 1").first();
    
    // 强制使用环境变量，确保后台配置生效
    const params = {
      appid: config.wx_appid,
      mch_id: env.WX_MCH_ID, 
      nonce_str: Math.random().toString(36).substring(2, 15),
      body: '宜人出行充值',
      out_trade_no: 'R' + Date.now(),
      total_fee: Math.round(parseFloat(data.amount) * 100),
      spbill_create_ip: '127.0.0.1',
      notify_url: `https://${new URL(request.url).hostname}/api/wx_notify`,
      trade_type: 'JSAPI',
      openid: data.openid
    };

    // 调试：打印关键参数，供您排查
    const debugInfo = `AppID:${params.appid}|MchID:${params.mch_id}|OpenID:${params.openid}`;

    const signStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + `&key=${env.WX_API_KEY}`;
    const hashBuffer = await crypto.subtle.digest('MD5', new TextEncoder().encode(signStr));
    params.sign = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

    const xml = `<xml>${Object.keys(params).map(k => `<${k}><![CDATA[${params[k]}]]></${k}>`).join('')}</xml>`;
    const response = await fetch('https://api.mch.weixin.qq.com/pay/unifiedorder', { method: 'POST', body: xml });
    const respText = await response.text();
    
    if (!respText.includes('<prepay_id>')) {
        return new Response(JSON.stringify({ error: "失败！检查配置: " + debugInfo + " | 微信返回: " + respText }), { status: 500 });
    }
    // ... 后续逻辑不变
    return new Response(JSON.stringify({ success: true, payArgs: { /*...*/ } }));
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
