// 请替换为你自己的微信服务号 AppID 和 AppSecret
const APP_ID = 'wx90223bd25485040a';
const APP_SECRET = '8a0ec5859557efb7548f10a8940e758f';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 前端传来的当前页面URL (必须完全匹配，包括查询参数)
  const targetUrl = url.searchParams.get("url"); 
  if (!targetUrl) return Response.json({ error: "Missing url param" });

  try {
    // 1. 获取 jsapi_ticket (优先从 KV 缓存读)
    let ticket = await env.WECHAT_CACHE.get("jsapi_ticket");
    
    if (!ticket) {
      // 1.1 缓存没有，去微信服务器拿 access_token
      const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`);
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error("Failed to get access_token");

      // 1.2 用 access_token 换 jsapi_ticket
      const ticketRes = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${tokenData.access_token}&type=jsapi`);
      const ticketData = await ticketRes.json();
      if (!ticketData.ticket) throw new Error("Failed to get jsapi_ticket");

      ticket = ticketData.ticket;
      // 写入缓存 (有效期 7000秒)
      await env.WECHAT_CACHE.put("jsapi_ticket", ticket, { expirationTtl: 7000 });
    }

    // 2. 生成签名
    const nonceStr = Math.random().toString(36).substr(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 签名算法: noncestr=xxx&jsapi_ticket=xxx&timestamp=xxx&url=xxx
    const strToSign = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${targetUrl}`;
    
    // SHA1 哈希
    const msgBuffer = new TextEncoder().encode(strToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. 返回给前端
    return Response.json({
      appId: APP_ID,
      timestamp: timestamp,
      nonceStr: nonceStr,
      signature: signature
    });

  } catch (e) {
    return Response.json({ error: e.message });
  }
}
