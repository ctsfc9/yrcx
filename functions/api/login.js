// 微信授权登录核心接口：从数据库动态安全读取密钥，用 code 换取头像昵称并存入数据库
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) return new Response(JSON.stringify({ error: '缺失授权凭证' }), { status: 400 });

  try {
    // 1. 安全配置对接：从数据库动态拉取管理员在后台填写的 AppID 和 AppSecret
    const config = await db.prepare("SELECT wx_appid, wx_appsecret FROM system_config LIMIT 1").first();
    const appId = config?.wx_appid || 'wx90223bd25485040a';
    const appSecret = config?.wx_appsecret;

    // 如果管理员还没有在后台配置密钥，直接安全拦截并给出提示
    if (!appSecret) {
        return new Response(JSON.stringify({ error: '请先前往管理后台 -> 基础通讯配置 中配置真实的微信 AppSecret 密钥。' }), { status: 500 });
    }

    // 2. 向微信官方发送请求，通过 code 换取 access_token 和 openid
    const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`);
    const tokenData = await tokenRes.json();

    if (tokenData.errcode) {
      return new Response(JSON.stringify({ error: '微信授权失败，code可能已过期或AppSecret配置有误', details: tokenData }), { status: 400 });
    }

    const { access_token, openid } = tokenData;

    // 3. 再次请求微信官方，拉取用户的真实微信头像和昵称
    const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`);
    const userData = await userRes.json();

    if (userData.errcode) {
       return new Response(JSON.stringify({ error: '拉取用户微信基础信息失败', details: userData }), { status: 400 });
    }

    // 4. 数据同步对齐：将最准确的微信用户信息存入数据库 (给管理后台的用户列表展现使用)
    const existingUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(openid).first();
    
    if (existingUser) {
       // 老用户：更新其可能随时变动的微信头像和昵称
       await db.prepare("UPDATE users SET nickname = ?, avatar = ? WHERE id = ?")
         .bind(userData.nickname, userData.headimgurl, openid).run();
    } else {
       // 新用户：自动在数据库注册建档
       await db.prepare("INSERT INTO users (id, nickname, avatar, balance, is_banned) VALUES (?, ?, ?, 0, 0)")
         .bind(openid, userData.nickname, userData.headimgurl).run();
    }

    // 5. 打包干净完整的登录数据返回给前端
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
