export async function onRequest(context) {
  const { request, env } = context;
  const code = new URL(request.url).searchParams.get('code');
  if (!code) return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });

  const config = await env.DB.prepare("SELECT wx_appid, wx_appsecret FROM system_config LIMIT 1").first();
  const res = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wx_appid}&secret=${config.wx_appsecret}&code=${code}&grant_type=authorization_code`);
  const data = await res.json();
  
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}
