export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) return Response.json({ error: "Missing url" });

  try {
    // 1. 优先从 KV 缓存获取 ticket
    let ticket = await env.WECHAT_CACHE.get("jsapi_ticket");

    if (!ticket) {
      // 2. 缓存没有，去微信服务器拿 (填写你的 AppID 和 Secret)
      const APP_ID = 'wx90223bd25485040a';       
      const APP_SECRET = '8a0ec5859557efb7548f10a8940e758f'; 

      const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`);
      const tokenData = await tokenRes.json();
      
      const ticketRes = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${tokenData.access_token}&type=jsapi`);
      const ticketData = await ticketRes.json();
      ticket = ticketData.ticket;

      // 3. 存入 KV (7000秒过期)
      await env.WECHAT_CACHE.put("jsapi_ticket", ticket, { expirationTtl: 7000 });
    }

    // 4. 计算签名
    const nonceStr = Math.random().toString(36).substr(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${targetUrl}`;
    
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    return Response.json({ appId: '你的AppID', timestamp, nonceStr, signature });

  } catch (e) {
    return Response.json({ error: e.message });
  }
}
