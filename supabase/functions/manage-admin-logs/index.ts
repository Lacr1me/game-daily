import { authenticatedUser, callSupabaseRpc, jsonResponse, parseCsv, readEnv, rejectDisallowedOrigin } from "../_shared/http.js";

const MAX_BODY_BYTES = 262_144;
const MAX_ITEMS = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LOG_KINDS = new Set(["website_change", "maintenance"]);
const LOG_STATUSES = new Set(["info", "success", "warning", "failure"]);

function encodeCursor(item) {
  return btoa(JSON.stringify({ occurredAt: item.occurred_at, id: item.id }))
    .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeCursor(value) {
  if (!value) return { occurredAt: null, id: null };
  try {
    const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    if (!Number.isFinite(Date.parse(parsed.occurredAt)) || !UUID_PATTERN.test(parsed.id)) throw new Error("Invalid cursor");
    return { occurredAt: parsed.occurredAt, id: parsed.id };
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}

function publicItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    occurredAt: item.occurred_at,
    title: item.title,
    summary: item.summary,
    status: item.status,
    source: item.source,
    metadata: item.metadata || {}
  };
}

async function requireAdministrator(request, origin) {
  let auth;
  try { auth = await authenticatedUser(request); } catch {
    return { response: jsonResponse(503, { error: { code: "AUTH_UNAVAILABLE", message: "登录验证暂时不可用。" } }, origin) };
  }
  if (!auth.ok) return { response: jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "请先登录后台。" } }, origin) };
  let allowedIds;
  try { allowedIds = new Set(parseCsv(readEnv("MESSAGE_ADMIN_USER_IDS"))); } catch (error) {
    return { response: jsonResponse(503, { error: { code: "SERVER_NOT_CONFIGURED", message: error.message } }, origin) };
  }
  if (!allowedIds.has(auth.user.id)) {
    return { response: jsonResponse(403, { error: { code: "FORBIDDEN", message: "当前账号没有管理员日志权限。" } }, origin) };
  }
  return { user: auth.user, response: null };
}

async function listLogs(request, origin) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "";
  if (!LOG_KINDS.has(kind)) return jsonResponse(400, { error: { code: "INVALID_KIND", message: "日志类型无效。" } }, origin);
  const rawLimit = Number(url.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20;
  let cursor;
  try { cursor = decodeCursor(url.searchParams.get("cursor") || ""); } catch {
    return jsonResponse(400, { error: { code: "INVALID_CURSOR", message: "分页参数无效。" } }, origin);
  }
  const result = await callSupabaseRpc("list_admin_logs_internal", {
    p_kind: kind,
    p_limit: limit + 1,
    p_cursor_occurred_at: cursor.occurredAt,
    p_cursor_id: cursor.id
  });
  if (!result.ok || !Array.isArray(result.data)) {
    console.error("list_admin_logs_internal failed", result.status, result.data);
    return jsonResponse(500, { error: { code: "ADMIN_LOG_LIST_FAILED", message: "管理员日志暂时无法读取。" } }, origin);
  }
  const rows = result.data;
  return jsonResponse(200, {
    items: rows.slice(0, limit).map(publicItem),
    nextCursor: rows.length > limit ? encodeCursor(rows[limit - 1]) : null
  }, origin);
}

async function syncAuthorized(request) {
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.match(/^Bearer\s+(\S+)$/u)?.[1] || "";
  let expected;
  try { expected = readEnv("ADMIN_LOG_SYNC_SECRET"); } catch (error) {
    return { ok: false, response: jsonResponse(503, { error: { code: "SERVER_NOT_CONFIGURED", message: error.message } }, null) };
  }
  const ok = await equalSecrets(supplied, expected);
  return ok
    ? { ok: true, response: null }
    : { ok: false, response: jsonResponse(401, { error: { code: "INVALID_SYNC_SECRET", message: "同步密钥无效。" } }, null) };
}

async function equalSecrets(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right))
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return Boolean(left) && difference === 0;
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  try { return JSON.parse(raw); } catch { throw new Error("INVALID_JSON"); }
}

function validateItems(body) {
  if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) throw new Error("INVALID_ITEMS");
  return body.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("INVALID_ITEM");
    const occurredAt = cleanString(item.occurredAt, 64);
    const metadata = item.metadata === undefined ? {} : item.metadata;
    if (!LOG_KINDS.has(item.kind) || !LOG_STATUSES.has(item.status)) throw new Error("INVALID_ITEM");
    if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("INVALID_ITEM");
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("INVALID_ITEM");
    const sourceKey = cleanString(item.sourceKey, 300);
    if (item.kind === "website_change" && sourceKey !== `website_change:${beijingDate(occurredAt)}`) throw new Error("INVALID_ITEM");
    return {
      kind: item.kind,
      occurred_at: new Date(occurredAt).toISOString(),
      title: cleanString(item.title, 160),
      summary: cleanString(item.summary, 2000),
      status: item.status,
      source: cleanString(item.source, 80),
      source_key: sourceKey,
      metadata
    };
  });
}

function beijingDate(value) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cleanString(value, maximum) {
  const text = String(value || "").trim();
  if (!text || Array.from(text).length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new Error("INVALID_ITEM");
  return text;
}

async function ingestLogs(request) {
  const auth = await syncAuthorized(request);
  if (!auth.ok) return auth.response;
  let body;
  try { body = await readJsonBody(request); } catch (error) {
    const tooLarge = error.message === "BODY_TOO_LARGE";
    return jsonResponse(tooLarge ? 413 : 400, { error: { code: error.message, message: tooLarge ? "请求内容过大。" : "请求格式无效。" } }, null);
  }
  let items;
  try { items = validateItems(body); } catch {
    return jsonResponse(400, { error: { code: "INVALID_ITEMS", message: "日志数据无效。" } }, null);
  }
  const result = await callSupabaseRpc("upsert_admin_logs_internal", { p_items: items });
  if (!result.ok || !Number.isInteger(result.data)) {
    console.error("upsert_admin_logs_internal failed", result.status, result.data);
    return jsonResponse(500, { error: { code: "ADMIN_LOG_SYNC_FAILED", message: "管理员日志同步失败。" } }, null);
  }
  return jsonResponse(200, { ok: true, upserted: result.data }, null);
}

Deno.serve(async (request) => {
  if (request.method === "POST") return ingestLogs(request);
  if (request.method === "GET" && !request.headers.get("authorization")) {
    return jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "请先登录后台。" } }, null);
  }
  const gate = rejectDisallowedOrigin(request);
  if (gate.response) return gate.response;
  const origin = gate.origin;
  if (request.method !== "GET") {
    return jsonResponse(405, { error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 GET 与 POST。" } }, origin, { Allow: "GET, POST, OPTIONS" });
  }
  const admin = await requireAdministrator(request, origin);
  if (admin.response) return admin.response;
  return listLogs(request, origin);
});
