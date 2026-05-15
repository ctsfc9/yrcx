export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Error', { status: 405 });
  try {
    const xmlText = await request.text();
    const getTag = (tag) => (xmlText.match(new RegExp(`<${tag}><!\\[CDATA\\[(.*)\\]\\]></${tag}>`)) || xmlText.match(new RegExp(`<${tag}>(.*)</${tag}>`)))?.[1];
    
    if (getTag('return_code') === 'SUCCESS' && getTag('result_code') === 'SUCCESS') {
      const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(getTag('out_trade_no')).first();
      if (order && order.status === 'pending') {
        const amount = parseFloat(getTag('total_fee')) / 100;
        await env.DB.batch([
          env.DB.prepare("UPDATE orders SET status = 'success' WHERE id = ?").bind(order.id),
          env.DB.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").bind(amount, order.user_id)
        ]);
      }
    }
    return new Response(`<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>`, { headers: { 'Content-Type': 'application/xml' } });
  } catch (e) { return new Response('Error', { status: 500 }); }
}
