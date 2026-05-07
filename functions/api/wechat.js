// 微信 JS-SDK 签名接口 (Cloudflare Pages Functions)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });
  }

  const APP_ID = 'wx90223bd25485040a';
  const APP_SECRET = '8a0ec5859557efb7548f10a8940e758f';

  try {
    // 1. 获取 access_token (实际生产环境建议在 KV 中缓存)
    const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`);
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. 获取 jsapi_ticket (实际生产环境建议在 KV 中缓存)
    const ticketRes = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`);
    const ticketData = await ticketRes.json();
    const ticket = ticketData.ticket;

    // 3. 生成签名
    const nonceStr = Math.random().toString(36).substr(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureStr = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${decodeURIComponent(targetUrl)}`;
    
    // SHA1 加密
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureStr);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return new Response(JSON.stringify({
      appId: APP_ID,
      timestamp,
      nonceStr,
      signature
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
