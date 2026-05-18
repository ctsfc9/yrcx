// SHA-1 加密算法 (Cloudflare Worker 原生支持)
async function sha1(str) {
  const buffer = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url).searchParams.get('url'); // 前端传来的当前页面URL

  if (!url) return new Response('Missing URL', { status: 400 });

  try {
    const config = await db.prepare("SELECT wx_appid, wx_appsecret, wx_ticket, ticket_expires FROM system_config LIMIT 1").first();
    const now = Math.floor(Date.now() / 1000);
    
    let ticket = config.wx_ticket;

    // 1. 如果 ticket 过期或不存在，重新向微信申请
    if (!ticket || config.ticket_expires < now) {
      // 获取 access_token (基础支持，不是网页授权那个)
      const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx_appid}&secret=${config.wx_appsecret}`);
      const tokenData = await tokenRes.json();
      
      if (tokenData.access_token) {
        // 获取 jsapi_ticket
        const ticketRes = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${tokenData.access_token}&type=jsapi`);
        const ticketData = await ticketRes.json();
        
        if (ticketData.ticket) {
          ticket = ticketData.ticket;
          // 缓存到数据库，有效期 7000 秒 (微信限制是7200秒)
          await db.prepare("UPDATE system_config SET wx_ticket = ?, ticket_expires = ? WHERE id = 1")
                  .bind(ticket, now + 7000).run();
        }
      }
    }

    // 2. 生成签名
    const nonceStr = Math.random().toString(36).substring(2, 15);
    const timestamp = now.toString();
    const decodedUrl = decodeURIComponent(url).split('#')[0]; // 微信要求去除 # 后的 hash 

    // 字典排序
    const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${decodedUrl}`;
    const signature = await sha1(str);

    // 3. 返回给前端用于 wx.config
    return new Response(JSON.stringify({
      appId: config.wx_appid,
      timestamp,
      nonceStr,
      signature
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
