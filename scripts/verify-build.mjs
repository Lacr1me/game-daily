import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertGameArchiveConsistency, assertManifestEdition, assertMinshengArchiveConsistency } from "./archive-consistency.mjs";
import { validateGame } from "./game-lib.mjs";
import { validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const output = path.join(root, "dist");
for (const file of ["index.html", "portal.js", "message-config.js", "message-client.js", "messages/index.html", "messages/messages.css", "messages/app.js", "admin/messages/index.html", "admin/messages/admin.css", "admin/messages/client.js", "admin/messages/app.js", "privacy/index.html", "privacy/privacy.css", "app.js", "game/index.html", "minsheng/index.html", "minsheng/message-link.css", "minsheng/aligned-layout.css", "brand-assets/springhues-logo.png", "data/index.json", "data/minsheng/index.json", ".nojekyll"]) {
  await access(path.join(output, file));
}
await access(path.join(output, "data", ".pending")).then(
  () => { throw new Error("构建产物不得包含 data/.pending 草稿"); },
  () => {}
);

const gameManifest = await readJson(path.join(output, "data", "index.json"));
const civicManifest = await readJson(path.join(output, "data", "minsheng", "index.json"));
const gameBriefs = [];
for (const edition of gameManifest.editions) {
  const brief = await readJson(path.join(output, edition.file));
  validateGame(brief, { expectedDate: edition.date });
  assertManifestEdition(edition, brief, "游戏日报");
  gameBriefs.push(brief);
}
for (const brief of gameBriefs) assertGameArchiveConsistency(brief, gameBriefs);
for (const edition of gameManifest.editions) {
  await assertPng(path.join(output, "downloads", "game", `${edition.date}.png`), `游戏日报 ${edition.date}`);
}

const civicBriefs = [];
for (const edition of civicManifest.editions) {
  const brief = await readJson(path.join(output, edition.file));
  validateMinsheng(brief, { expectedDate: edition.date });
  assertManifestEdition(edition, brief, "民生日报");
  civicBriefs.push(brief);
}
for (const brief of civicBriefs) assertMinshengArchiveConsistency(brief, civicBriefs);
for (const edition of civicManifest.editions) {
  await assertPng(path.join(output, "downloads", "minsheng", `${edition.date}.png`), `民生日报 ${edition.date}`);
}
const portalHtml = await readFile(path.join(output, "index.html"), "utf8");
const messageHtml = await readFile(path.join(output, "messages", "index.html"), "utf8");
const adminHtml = await readFile(path.join(output, "admin", "messages", "index.html"), "utf8");
const gameHtml = await readFile(path.join(output, "game", "index.html"), "utf8");
const minshengHtml = await readFile(path.join(output, "minsheng", "index.html"), "utf8");
const privacyHtml = await readFile(path.join(output, "privacy", "index.html"), "utf8");
if (!portalHtml.includes('class="quick-message-link"') || portalHtml.includes("data-message-form")) throw new Error("首页必须只保留左对齐留言入口，不得包含快捷留言表单");
if (!messageHtml.includes('id="messageList"') || !messageHtml.includes("data-message-form")) throw new Error("构建产物缺少完整留言页");
if (!adminHtml.includes('name="robots" content="noindex,nofollow,noarchive"') || !adminHtml.includes('http-equiv="Cache-Control" content="no-store') || !adminHtml.includes('id="loginForm"')) throw new Error("构建产物缺少受保护且禁缓存的留言后台登录页");
if (!adminHtml.includes('role="tablist"') || !adminHtml.includes('id="websiteChangesPanel"') || !adminHtml.includes('id="maintenancePanel"') || !adminHtml.includes('id="messagesTab" class="active"')) throw new Error("构建产物缺少默认留言审核的管理员三标签页");
if (!gameHtml.includes('class="header-message-link" href="messages/"') || !minshengHtml.includes('class="header-message-link" href="../messages/"')) throw new Error("两个日报页头必须包含频道色留言按钮");
if (!privacyHtml.includes("Turnstile Privacy Addendum") || !privacyHtml.includes("来源哈希")) throw new Error("构建产物缺少留言隐私说明");
console.log("构建产物验证通过：公开文件完整，草稿已排除，双频道入口、留言回复与管理后台有效。");

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function assertPng(file, label) {
  const buffer = await readFile(file);
  if (buffer.length <= 24) throw new Error(`${label} PNG 文件不能为空`);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`${label} 必须是有效 PNG`);
  if (buffer.readUInt32BE(16) !== 3840) throw new Error(`${label} PNG 宽度必须为 3840px`);
}
