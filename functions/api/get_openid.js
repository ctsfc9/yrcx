export async function onRequest(context) {
  const { request, env } = context;
  const code = new URL(request.url).searchParams.get('code');
  
  if (!code) return new Response(JSON.stringify({ error: 'Missing code' }), { status: 400 });

  try {
    const db = env.DB;
    const config = await db.prepare("SELECT wx_appid, wx_appsecret FROM system_config LIMIT 1").first();
    
    // 1. 用 code 换取 access_token 和 openid
    const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.wx_appid}&secret=${config.wx_appsecret}&code=${code}&grant_type=authorization_code`);
    const tokenData = await tokenRes.json();
    
    if (!tokenData.openid) {
        return new Response(JSON.stringify({ error: '获取 token 失败', details: tokenData }), { status: 500 });
    }

    // 2. 核心修改：用 access_token 拉取用户的真实微信头像和昵称
    const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}&lang=zh_CN`);
    const userData = await userRes.json();

    // 3. 检查数据库中是否已有该用户
    let existingUser = await db.prepare("SELECT id FROM users WHERE openid = ?").bind(tokenData.openid).first();
    let userId = existingUser ? existingUser.id : ('user_wx_' + Date.now());

    const nickname = userData.nickname || '微信用户';
    const avatar = userData.headimgurl || 'https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg';

    if (!existingUser) {
        // 新用户入库
        await db.prepare("INSERT INTO users (id, openid, nickname, avatar) VALUES (?, ?, ?, ?)")
            .bind(userId, tokenData.openid, nickname, avatar).run();
    } else {
        // 老用户更新头像
        await db.prepare("UPDATE users SET nickname = ?, avatar = ? WHERE id = ?")
            .bind(nickname, avatar, userId).run();
    }
    
    // 4. 将完整数据返回给前端
    return new Response(JSON.stringify({ 
        id: userId,
        openid: tokenData.openid,
        nickname: nickname,
        avatar: avatar
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
