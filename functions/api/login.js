// 微信授权登录核心：安全读取密钥，换取身份，存入数据库
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) return new Response(JSON.stringify({ error: '缺失授权凭证' }), { status: 400 });

  try {
    const config = await db.prepare("SELECT wx_appid FROM system_config LIMIT 1").first();
    const appId = config?.wx_appid || 'wx90223bd25485040a';

    // 安全防御：确保密钥表存在，并读取密钥
    await db.prepare("CREATE TABLE IF NOT EXISTS app_secrets (key TEXT PRIMARY KEY, value TEXT)").run();
    const secretRow = await db.prepare("SELECT value FROM app_secrets WHERE key = 'wx_appsecret'").first();
    const appSecret = secretRow?.value;

    if (!appSecret) {
        return new Response(JSON.stringify({ error: '系统拦截：您还未在管理后台配置 AppSecret 密钥。' }), { status: 500 });
    }

    const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) return new Response(JSON.stringify({ error: '微信授权失败，凭证过期', details: tokenData }), { status: 400 });

    const { access_token, openid } = tokenData;

    const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`);
    const userData = await userRes.json();

    if (userData.errcode) return new Response(JSON.stringify({ error: '获取微信基础信息失败', details: userData }), { status: 400 });

    // 核心对齐：存入数据库供后台管理使用
    const existingUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(openid).first();
    
    if (existingUser) {
       await db.prepare("UPDATE users SET nickname = ?, avatar = ? WHERE id = ?").bind(userData.nickname, userData.headimgurl, openid).run();
    } else {
       await db.prepare("INSERT INTO users (id, nickname, avatar, balance, is_banned) VALUES (?, ?, ?, 0, 0)").bind(openid, userData.nickname, userData.headimgurl).run();
    }

    return new Response(JSON.stringify({
      id: openid,
      nickname: userData.nickname,
      avatar: userData.headimgurl,
      phone: existingUser?.phone || '' 
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
