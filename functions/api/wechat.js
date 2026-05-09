// 微信接口处理 (Cloudflare Pages Functions)
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  const APP_ID = 'wx90223bd25485040a';
  const APP_SECRET = '8a0ec5859557efb7548f10a8940e758f';

  // 1. 获取用户信息 (通过 code 换取)
  if (action === 'userinfo') {
    const code = url.searchParams.get('code');
    if (!code) return Response.json({ error: 'Missing code' }, { status: 400 });

    try {
      // 通过 code 换取 access_token
      const authRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${APP_ID}&secret=${APP_SECRET}&code=${code}&grant_type=authorization_code`);
      const authData = await authRes.json();
      
      if (authData.errcode) return Response.json(authData, { status: 400 });

      // 获取用户信息
      const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${authData.access_token}&openid=${authData.openid}&lang=zh_CN`);
      const userData = await userRes.json();
      
      return Response.json(userData);
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }
  }

  // 2. JS-SDK 签名接口
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return Response.json({ error: 'Missing url' }, { status: 400 });

  try {
    const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`);
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const ticketRes = await fetch(`https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`);
    const ticketData = await ticketRes.json();
    const ticket = ticketData.ticket;

    const nonceStr = Math.random().toString(36).substr(2, 15);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureStr = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${decodeURIComponent(targetUrl)}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureStr);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return Response.json({ appId: APP_ID, timestamp, nonceStr, signature });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
