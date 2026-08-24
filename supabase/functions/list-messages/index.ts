import { callSupabaseRpc, jsonResponse, rejectDisallowedOrigin } from "../_shared/http.js";

function encodeCursor(item) {
  return btoa(JSON.stringify({ approvedAt: item.approved_at, id: item.id }))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");
}

function decodeCursor(value) {
  if (!value) return { approvedAt: null, id: null };
  try {
    const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(base64));
    if (!Number.isFinite(Date.parse(parsed.approvedAt)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(parsed.id)) throw new Error("Invalid cursor");
    return { approvedAt: parsed.approvedAt, id: parsed.id };
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  const gate = rejectDisallowedOrigin(request);
  if (gate.response) return gate.response;
  const origin = gate.origin;
  if (request.method !== "GET") {
    return jsonResponse(405, { error: { code: "METHOD_NOT_ALLOWED", message: "仅支持 GET。" } }, origin, { Allow: "GET, OPTIONS" });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1), 50);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  if (!cursor) {
    return jsonResponse(400, { error: { code: "INVALID_CURSOR", message: "分页游标无效。" } }, origin);
  }
  const result = await callSupabaseRpc("list_approved_messages_internal", {
    p_limit: limit + 1,
    p_cursor_approved_at: cursor.approvedAt,
    p_cursor_id: cursor.id
  });
  if (!result.ok || !Array.isArray(result.data)) {
    console.error("list_approved_messages_internal failed", result.status, result.data);
    return jsonResponse(500, { error: { code: "LIST_FAILED", message: "留言暂时无法读取，请稍后重试。" } }, origin);
  }

  const hasMore = result.data.length > limit;
  const rows = result.data.slice(0, limit);
  const items = rows.map((item) => ({
    id: item.id,
    nickname: item.nickname,
    content: item.content,
    approvedAt: item.approved_at
  }));
  const nextCursor = hasMore && rows.length ? encodeCursor(rows.at(-1)) : null;
  return jsonResponse(200, { items, nextCursor }, origin, { "Cache-Control": "public, max-age=30" });
});
