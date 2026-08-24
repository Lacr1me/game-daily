import { authenticatedUser, callSupabaseRpc, jsonResponse, parseCsv, readEnv, rejectDisallowedOrigin } from "../_shared/http.js";
import { validateReplyInput } from "../_shared/validation.js";

const MAX_BODY_BYTES = 4096;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MESSAGE_STATUSES = new Set(["pending", "approved", "rejected"]);

function encodeCursor(item) {
  return btoa(JSON.stringify({ createdAt: item.created_at, id: item.id }))
    .replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function decodeCursor(value) {
  if (!value) return { createdAt: null, id: null };
  try {
    const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    if (!Number.isFinite(Date.parse(parsed.createdAt)) || !UUID_PATTERN.test(parsed.id)) throw new Error("Invalid cursor");
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new Error("INVALID_CURSOR");
  }
}

function adminItem(item) {
  return {
    id: item.id,
    nickname: item.nickname,
    content: item.content,
    status: item.status,
    createdAt: item.created_at,
    approvedAt: item.approved_at,
    reply: item.owner_reply && item.owner_replied_at
      ? { content: item.owner_reply, repliedAt: item.owner_replied_at }
      : null
  };
}

async function requireAdministrator(request, origin) {
  let auth;
  try { auth = await authenticatedUser(request); } catch {
    return { response: jsonResponse(503, { error: { code: "AUTH_UNAVAILABLE", message: "登录验证暂时不可用。" } }, origin) };
  }
  if (!auth.ok) {
    return { response: jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "请先登录后台。" } }, origin) };
  }
  let allowedIds;
  try { allowedIds = new Set(parseCsv(readEnv("MESSAGE_ADMIN_USER_IDS"))); } catch (error) {
    return { response: jsonResponse(503, { error: { code: "SERVER_NOT_CONFIGURED", message: error.message } }, origin) };
  }
  if (!allowedIds.has(auth.user.id)) {
    return { response: jsonResponse(403, { error: { code: "FORBIDDEN", message: "当前账号没有留言管理权限。" } }, origin) };
  }
  return { user: auth.user, response: null };
}

async function listMessages(request, origin) {
  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status") || "pending";
  if (requestedStatus !== "all" && !MESSAGE_STATUSES.has(requestedStatus)) {
    return jsonResponse(400, { error: { code: "INVALID_STATUS", message: "审核状态无效。" } }, origin);
  }
  const rawLimit = Number(url.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20;
  let cursor;
  try { cursor = decodeCursor(url.searchParams.get("cursor") || ""); } catch {
    return jsonResponse(400, { error: { code: "INVALID_CURSOR", message: "分页参数无效。" } }, origin);
  }
  const result = await callSupabaseRpc("list_messages_for_admin_internal", {
    p_status: requestedStatus === "all" ? null : requestedStatus,
    p_limit: limit + 1,
    p_cursor_created_at: cursor.createdAt,
    p_cursor_id: cursor.id
  });
  if (!result.ok || !Array.isArray(result.data)) {
    console.error("list_messages_for_admin_internal failed", result.status, result.data);
    return jsonResponse(500, { error: { code: "ADMIN_LIST_FAILED", message: "审核队列暂时无法读取。" } }, origin);
  }
  const rows = result.data;
  const items = rows.slice(0, limit).map(adminItem);
  return jsonResponse(200, { items, nextCursor: rows.length > limit ? encodeCursor(rows[limit - 1]) : null }, origin);
}

async function updateMessage(request, origin, administratorId) {
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
  if (!UUID_PATTERN.test(String(body?.id || ""))) {
    return jsonResponse(400, { error: { code: "INVALID_ID", message: "留言 ID 无效。" } }, origin);
  }
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasReply = Object.prototype.hasOwnProperty.call(body, "reply");
  if (!hasStatus && !hasReply) {
    return jsonResponse(400, { error: { code: "EMPTY_UPDATE", message: "没有需要保存的更改。" } }, origin);
  }
  if (hasStatus && !MESSAGE_STATUSES.has(body.status)) {
    return jsonResponse(400, { error: { code: "INVALID_STATUS", message: "审核状态无效。" } }, origin);
  }
  const reply = hasReply ? validateReplyInput(body.reply) : { ok: true, reply: null };
  if (!reply.ok) return jsonResponse(400, { error: { code: reply.code, message: reply.message } }, origin);

  const result = await callSupabaseRpc("update_message_for_admin_internal", {
    p_id: body.id,
    p_status: hasStatus ? body.status : null,
    p_set_reply: hasReply,
    p_reply: reply.reply,
    p_admin_id: administratorId
  });
  if (!result.ok || !Array.isArray(result.data)) {
    console.error("update_message_for_admin_internal failed", result.status, result.data);
    return jsonResponse(500, { error: { code: "ADMIN_UPDATE_FAILED", message: "留言暂时无法更新。" } }, origin);
  }
  if (!result.data.length) return jsonResponse(404, { error: { code: "MESSAGE_NOT_FOUND", message: "留言不存在。" } }, origin);
  return jsonResponse(200, { item: adminItem(result.data[0]) }, origin);
}

Deno.serve(async (request) => {
  const gate = rejectDisallowedOrigin(request);
  if (gate.response) return gate.response;
  const origin = gate.origin;
  const admin = await requireAdministrator(request, origin);
  if (admin.response) return admin.response;
  if (request.method === "GET") return listMessages(request, origin);
  if (request.method === "PATCH") return updateMessage(request, origin, admin.user.id);
  return jsonResponse(405, { error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 GET 与 PATCH。" } }, origin, { Allow: "GET, PATCH, OPTIONS" });
});
