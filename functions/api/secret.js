// 独立安全的系统密钥持久化存储接口
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;
    
    // 自动在数据库中新建一张专属的密钥表（如果不存在的话），绝不污染旧表
    await db.prepare("CREATE TABLE IF NOT EXISTS app_secrets (key TEXT PRIMARY KEY, value TEXT)").run();

    if (request.method === 'GET') {
        const res = await db.prepare("SELECT value FROM app_secrets WHERE key = 'wx_appsecret'").first();
        return new Response(JSON.stringify({ wx_appsecret: res?.value || '' }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
        const data = await request.json();
        if (data.wx_appsecret !== undefined) {
            // 安全写入，遇冲突则更新
            await db.prepare("INSERT INTO app_secrets (key, value) VALUES ('wx_appsecret', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(data.wx_appsecret).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
