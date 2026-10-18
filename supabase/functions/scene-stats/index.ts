// 场景页的数据接口：把 GoatCounter 的公开计数转发给浏览器，并补上跨域头。
// 只读取一个固定的公开地址，不接触任何密钥或用户数据。
const COUNTER = "https://springhues.goatcounter.com/counter/TOTAL.json";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (request.method !== "GET") return json(405, { error: "method not allowed" });

  try {
    const response = await fetch(COUNTER, { headers: { "User-Agent": "springhues-scene" } });
    if (!response.ok) return json(502, { error: `upstream ${response.status}` });
    const data = await response.json();
    return json(200, {
      visits: Number(data.count) || 0,
      visitors: Number(data.count_unique) || 0,
      updated: new Date().toISOString()
    });
  } catch (error) {
    return json(502, { error: String(error) });
  }
});
