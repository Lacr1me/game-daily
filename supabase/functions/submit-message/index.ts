import { callSupabaseRpc, clientIp, hmacSha256, jsonResponse, parseCsv, readEnv, rejectDisallowedOrigin } from "../_shared/http.js";
import { validateMessageInput } from "../_shared/validation.js";

const MAX_BODY_BYTES = 4096;

Deno.serve(async (request) => {
  const gate = rejectDisallowedOrigin(request);
  if (gate.response) return gate.response;
  const origin = gate.origin;
  if (request.method !== "POST") {
    return jsonResponse(405, { error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 POST。" } }, origin, { Allow: "POST, OPTIONS" });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: { code: "BODY_TOO_LARGE", message: "请求内容过大。" } }, origin);
  }

  let rawBody;
  try { rawBody = await request.text(); } catch {
    return jsonResponse(400, { error: { code: "INVALID_BODY", message: "请求内容无法读取。" } }, origin);
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: { code: "BODY_TOO_LARGE", message: "请求内容过大。" } }, origin);
  }

  let body;
  try { body = JSON.parse(rawBody); } catch {
    return jsonResponse(400, { error: { code: "INVALID_JSON", message: "请求格式无效。" } }, origin);
  }
  if (String(body?.website || "").trim()) {
    return jsonResponse(202, { ok: true, status: "pending" }, origin);
  }

  const validated = validateMessageInput(body);
  if (!validated.ok) {
    return jsonResponse(400, { error: { code: validated.code, message: validated.message } }, origin);
  }
  const turnstileToken = String(body?.turnstileToken || "");
  if (!turnstileToken || turnstileToken.length > 2048) {
    return jsonResponse(400, { error: { code: "TURNSTILE_REQUIRED", message: "请完成人机验证。" } }, origin);
  }

  const ip = clientIp(request);
  const turnstile = new URLSearchParams({
    secret: readEnv("TURNSTILE_SECRET_KEY"),
    response: turnstileToken,
    remoteip: ip
  });
  let turnstileResult;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: turnstile });
    turnstileResult = await response.json();
  } catch {
    return jsonResponse(503, { error: { code: "TURNSTILE_UNAVAILABLE", message: "验证服务暂时不可用，请稍后重试。" } }, origin);
  }
  const allowedHostnames = new Set(parseCsv(readEnv("TURNSTILE_ALLOWED_HOSTNAMES")));
  if (!turnstileResult?.success || !allowedHostnames.has(turnstileResult.hostname)) {
    return jsonResponse(403, { error: { code: "TURNSTILE_FAILED", message: "人机验证失败，请重试。" } }, origin);
  }

  const submitterHash = await hmacSha256(ip, readEnv("RATE_LIMIT_SECRET"));
  const inserted = await callSupabaseRpc("submit_message_internal", {
    p_nickname: validated.nickname,
    p_content: validated.content,
    p_submitter_hash: submitterHash
  });
  if (!inserted.ok) {
    if (inserted.text.includes("MESSAGE_RATE_LIMITED")) {
      return jsonResponse(429, { error: { code: "RATE_LIMITED", message: "提交过于频繁，请十分钟后再试。" } }, origin, { "Retry-After": "600" });
    }
    console.error("submit_message_internal failed", inserted.status, inserted.data);
    return jsonResponse(500, { error: { code: "SUBMIT_FAILED", message: "留言暂时无法提交，请稍后重试。" } }, origin);
  }
  return jsonResponse(202, { ok: true, status: "pending" }, origin);
});
