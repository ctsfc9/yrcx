// 独立安全的系统密钥批量持久化存储接口
export async function onRequest(context) {
    const { request, env } = context;
    const db = env.DB;
    
    await db.prepare("CREATE TABLE IF NOT EXISTS app_secrets (key TEXT PRIMARY KEY, value TEXT)").run();

    if (request.method === 'GET') {
        const { results } = await db.prepare("SELECT * FROM app_secrets").all();
        const secrets = {};
        results.forEach(r => secrets[r.key] = r.value);
        return new Response(JSON.stringify(secrets), { headers: { 'Content-Type': 'application/json' } });
    }

    if (request.method === 'POST') {
        const data = await request.json();
        const stmts = [];
        // 遍历并批量保存四个微信配置项
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                stmts.push(
                    db.prepare("INSERT INTO app_secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, String(value))
                );
            }
        }
        if (stmts.length > 0) {
            await db.batch(stmts);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Method Not Allowed', { status: 405 });
}
