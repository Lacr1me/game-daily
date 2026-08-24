import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { MESSAGE_LIMITS as browserLimits, MessageApi, MessageApiError, normalizeContent, normalizeNickname, validateMessage } from "../message-client.js";
import { MESSAGE_LIMITS as serverLimits, validateMessageInput } from "../supabase/functions/_shared/validation.js";

const root = process.cwd();
assert.deepEqual(browserLimits, serverLimits, "浏览器与服务端必须使用相同留言长度限制");
assert.equal(normalizeNickname("  小  春  "), "小 春");
assert.equal(normalizeContent("  第一行\r\n第二行  "), "第一行\n第二行");
assert(validateMessage({ nickname: "访客", content: "你好" }).ok);
assert(!validateMessage({ nickname: "", content: "你好" }).ok);
assert(!validateMessage({ nickname: "访客", content: "x".repeat(301) }).ok);
assert(validateMessage({ nickname: "😀", content: "保留 <script>alert(1)</script> 为纯文本" }).ok);
assert(validateMessageInput({ nickname: "访客", content: "正常留言" }).ok);
assert(!validateMessageInput({ nickname: "访客", content: "\u0000" }).ok);

let submittedRequest;
const submitApi = new MessageApi({ apiBaseUrl: "https://example.supabase.co/functions/v1" }, async (url, options) => {
  submittedRequest = { url, options };
  return jsonResponse(202, { ok: true, status: "pending" });
});
const submitted = await submitApi.submit({ nickname: "  访客  ", content: "  一条留言  ", turnstileToken: "test-token", website: "" });
assert.equal(submitted.status, "pending");
assert.equal(submittedRequest.url, "https://example.supabase.co/functions/v1/submit-message");
assert.deepEqual(JSON.parse(submittedRequest.options.body), { nickname: "访客", content: "一条留言", turnstileToken: "test-token", website: "" });

const listApi = new MessageApi({ apiBaseUrl: "https://example.supabase.co/functions/v1" }, async (url) => {
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("cursor"), "cursor-token");
  return jsonResponse(200, { items: [{ id: "1", nickname: "春", content: "你好", approvedAt: "2026-08-24T11:00:00Z" }], nextCursor: null });
});
const listed = await listApi.list({ cursor: "cursor-token", limit: 20 });
assert.equal(listed.items.length, 1);

const errorApi = new MessageApi({ apiBaseUrl: "https://example.supabase.co/functions/v1" }, async () => jsonResponse(429, { error: { code: "RATE_LIMITED", message: "提交过于频繁" } }));
await assert.rejects(() => errorApi.submit({ nickname: "访客", content: "你好", turnstileToken: "token" }), (error) => error instanceof MessageApiError && error.code === "RATE_LIMITED" && error.status === 429);

const portalHtml = await read("index.html");
const messagesHtml = await read("messages/index.html");
const messagesApp = await read("messages/app.js");
const config = await read("message-config.js");
const migration = await read("supabase/migrations/202608240001_create_messages.sql");
const submitFunction = await read("supabase/functions/submit-message/index.ts");
const listFunction = await read("supabase/functions/list-messages/index.ts");

assert(portalHtml.includes("<h1>简单人生</h1>"), "首页必须使用已确认的简单人生标题");
assert(portalHtml.includes('href="messages/"') && portalHtml.includes("data-message-form"), "首页必须包含留言入口与快捷表单");
assert(messagesHtml.includes('id="messageList"') && messagesHtml.includes("data-message-counter"), "独立留言页必须包含完整表单与公开列表");
assert(!/\.innerHTML\s*=/.test(messagesApp), "留言列表不得使用 innerHTML 渲染用户内容");
assert(messagesApp.includes("textContent = item.nickname") && messagesApp.includes("textContent = item.content"), "用户内容必须通过 textContent 渲染");
assert(!/SERVICE_ROLE|SECRET_KEY|RATE_LIMIT_SECRET/u.test(config), "公开配置不得包含服务端秘密字段");
assert(migration.includes("enable row level security") && migration.includes("revoke all on table public.messages from anon, authenticated"), "留言表必须默认拒绝匿名直连");
assert(migration.includes("MESSAGE_RATE_LIMITED") && migration.includes("status = 'approved'"), "数据库必须执行限流并仅查询已批准留言");
assert(submitFunction.includes("siteverify") && submitFunction.includes("hmacSha256") && submitFunction.includes("TURNSTILE_ALLOWED_HOSTNAMES"), "提交函数必须验证 Turnstile、来源主机和哈希限流键");
assert(submitFunction.includes("new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES"), "提交函数必须按实际字节数限制请求体");
assert(listFunction.includes("list_approved_messages_internal") && !listFunction.includes("submitter_hash"), "公开列表不得返回提交者哈希");

console.log("留言系统测试通过：输入校验、API 契约、RLS、Turnstile、限流、纯文本渲染与页面结构均有效。");

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
async function read(file) { return readFile(path.join(root, file), "utf8"); }
