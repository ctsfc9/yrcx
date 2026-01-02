export async function onRequest(context) {
  const { DB } = context.env; // 获取数据库绑定

  try {
    // 简单的查询逻辑
    const { results } = await DB.prepare("SELECT * FROM rides").all();
    return Response.json({ results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
