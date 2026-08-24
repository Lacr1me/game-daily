export function readEnv(name) {
  const value = globalThis.Deno?.env?.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function parseCsv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function allowedOrigin(request) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(parseCsv(readEnv("ALLOWED_ORIGINS")));
  return allowed.has(origin) ? origin : null;
}

export function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export function jsonResponse(status, body, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
      ...extraHeaders
    }
  });
}

export function rejectDisallowedOrigin(request) {
  let origin = null;
  try { origin = allowedOrigin(request); } catch (error) {
    return { origin: null, response: jsonResponse(503, { error: { code: "SERVER_NOT_CONFIGURED", message: error.message } }, null) };
  }
  if (!origin) {
    return { origin: null, response: jsonResponse(403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "请求来源不受信任。" } }, null) };
  }
  if (request.method === "OPTIONS") {
    return { origin, response: new Response(null, { status: 204, headers: corsHeaders(origin) }) };
  }
  return { origin, response: null };
}

export function clientIp(request) {
  return (request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "unknown")
    .split(",")[0]
    .trim();
}

export async function hmacSha256(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function callSupabaseRpc(name, body) {
  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data, text };
}
