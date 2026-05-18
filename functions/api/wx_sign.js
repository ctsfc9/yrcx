// SHA-1 纯净版加密算法
async function sha1(str) {
  const buffer = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url).searchParams.get('url');

  if (!url) return new Response(JSON.stringify({ error: '缺少 URL 参数' }), { status: 400 });

  try {
    const config = await db.prepare("SELECT wx_appid, wx_appsecret, wx_ticket, ticket_expires FROM system_config LIMIT 1").first();
    
    if (!config || !config.wx_appid || !config.wx_appsecret) {
       return new Response(JSON.stringify({ error: '后台未配置 AppID 或 AppSecret' }), { status: 500 });
    }

    const now = Math.floor(Date.now() / 1000);
    let ticket = config.wx_ticket;

    // 1. 如果没有 ticket 或者已过期，重新向微信请求
    if (!ticket || config.ticket_expires < now) {
      
      // 第1步：获取基础 access_token
      const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wx_appid}&secret=${config.wx_appsecret}`);
      const tokenData = await tokenRes.json();
      
      // 如果微信拦截（例如 IP 白名单报错 40164），直接把错误抛给前端
      if (!tokenData.access_token) {
          return new Response(JSON.stringify({ error: '微信Token请求被拦截', details: tokenData }), { status: 500 });
      }

      // 第2步：获取 jsapi_ticket
      const ticketRes = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${tokenData.access_token}&type=jsapi`);
      const ticketData = await ticketRes.json();
      
      if (!ticketData.ticket) {
          return new Response(JSON.stringify({ error: '微信Ticket请求失败', details: ticketData }), { status: 500 });
      }

      ticket = ticketData.ticket;
      
      // 写入数据库缓存（有效期 7000 秒，微信官方上限是7200秒）
      await db.prepare("UPDATE system_config SET wx_ticket = ?, ticket_expires = ? WHERE id = 1")
              .bind(ticket, now + 7000).run();
    }

    // 2. 严格按照微信要求拼接字符串进行签名
    const nonceStr = Math.random().toString(36).substring(2, 15);
    const timestamp = now.toString();
    const decodedUrl = decodeURIComponent(url).split('#')[0]; // 必须严格去除 # 及其后边部分

    const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${decodedUrl}`;
    const signature = await sha1(str);

    // 3. 将成功生成的参数返回给前端
    return new Response(JSON.stringify({
      appId: config.wx_appid,
      timestamp,
      nonceStr,
      signature,
      debug_url: decodedUrl // 返回前端核对URL是否一致
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器内部错误: ' + e.message }), { status: 500 });
  }
}
