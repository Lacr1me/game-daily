import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertGameArchiveConsistency, assertManifestEdition, assertMinshengArchiveConsistency } from "./archive-consistency.mjs";
import { assertPublishTime as assertGamePublishTime, beijingDate, validateGame } from "./game-lib.mjs";
import { httpFallbackBase, tlsCertificateCode } from "./health-lib.mjs";
import { assertPublishTime as assertMinshengPublishTime, validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const civicManifest = await readJson("data/minsheng/index.json");
const gameManifest = await readJson("data/index.json");

for (const [name, manifest] of [["民生", civicManifest], ["游戏", gameManifest]]) {
  assert(manifest.timezone === "Asia/Shanghai", `${name}频道时区必须为 Asia/Shanghai`);
  assert(manifest.generateAt === "10:30", `${name}频道必须在 10:30 开始制作`);
  assert(manifest.publishAt === "11:00", `${name}频道必须在 11:00 发布`);
  assert(Array.isArray(manifest.editions) && manifest.editions.length > 0, `${name}频道必须至少有一期归档`);
  assert(new Set(manifest.editions.map((edition) => edition.date)).size === manifest.editions.length, `${name}归档日期不能重复`);
  assert(new Set(manifest.editions.map((edition) => edition.issue)).size === manifest.editions.length, `${name}归档期号不能重复`);
  assert(isSorted(manifest.editions), `${name}归档必须按日期倒序`);
  for (const edition of manifest.editions) {
    assert(edition.publishAt === `${edition.date}T11:00:00+08:00`, `${name} ${edition.date} 发布时间必须为北京时间11:00`);
    assert(new Date(edition.publishAt).getTime() <= Date.now(), `${name} ${edition.date} 尚未到发布时间，不得进入公开归档`);
    if (edition.backfilledAt) {
      assert(Number.isFinite(new Date(edition.backfilledAt).getTime()), `${name} ${edition.date} 补档时间无效`);
      assert(new Date(edition.backfilledAt) > new Date(edition.publishAt), `${name} ${edition.date} 补档时间必须晚于计划发布时间`);
    }
    await access(path.join(root, edition.file));
  }
}

const latestCivic = civicManifest.editions[0];
const civic = await readJson(latestCivic.file);
validateMinsheng(civic, { expectedDate: latestCivic.date });
assert(Object.values(civic.sections).flat().length === 35, "最新民生日报必须包含35条新闻");
assert(civic.topStoryIds.length === 3, "最新民生日报必须包含3条正文引用式头条");

const civicBriefs = [];
for (const edition of civicManifest.editions) {
  const brief = await readJson(edition.file);
  validateMinsheng(brief, { expectedDate: edition.date });
  assertManifestEdition(edition, brief, "民生日报");
  civicBriefs.push(brief);
}
for (const brief of civicBriefs) assertMinshengArchiveConsistency(brief, civicBriefs);
for (const edition of civicManifest.editions) {
  await assertPng(path.join(root, "downloads", "minsheng", `${edition.date}.png`), `民生日报 ${edition.date}`);
}

const latestGame = gameManifest.editions[0];
const game = await readJson(latestGame.file);
validateGame(game, { expectedDate: latestGame.date });
assert(latestGame.date <= beijingDate(), "最新游戏日报日期不得晚于北京时间当天");

const gameBriefs = [];
for (const edition of gameManifest.editions) {
  const brief = await readJson(edition.file);
  validateGame(brief, { expectedDate: edition.date });
  assertManifestEdition(edition, brief, "游戏日报");
  gameBriefs.push(brief);
}
for (const brief of gameBriefs) assertGameArchiveConsistency(brief, gameBriefs);
for (const edition of gameManifest.editions) {
  await assertPng(path.join(root, "downloads", "game", `${edition.date}.png`), `游戏日报 ${edition.date}`);
}

const copiedGame = structuredClone(game);
copiedGame.date = nextIsoDate(game.date);
assertThrows(() => assertGameArchiveConsistency(copiedGame, gameBriefs), "复制上一期的游戏日报必须被拒绝");
const copiedCivic = structuredClone(civic);
copiedCivic.date = nextIsoDate(civic.date);
assertThrows(() => assertMinshengArchiveConsistency(copiedCivic, civicBriefs), "复制上一期的民生日报必须被拒绝");

assertThrows(() => assertGamePublishTime("2026-08-24", new Date("2026-08-24T10:59:59+08:00")), "游戏日报必须拒绝11:00前发布");
assertThrows(() => assertMinshengPublishTime("2026-08-24", new Date("2026-08-24T10:59:59+08:00")), "民生日报必须拒绝11:00前发布");
assertGamePublishTime("2026-08-24", new Date("2026-08-24T11:00:00+08:00"));
assertMinshengPublishTime("2026-08-24", new Date("2026-08-24T11:00:00+08:00"));

const certificateError = Object.assign(new Error("fetch failed"), {
  cause: Object.assign(new Error("hostname mismatch"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" })
});
assert(tlsCertificateCode(certificateError) === "ERR_TLS_CERT_ALTNAME_INVALID", "健康检查必须识别嵌套的 HTTPS 证书错误");
assert(tlsCertificateCode(Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } })) === null, "普通网络故障不得伪装成证书错误");
assert(httpFallbackBase("https://springhues.com/") === "http://springhues.com", "证书错误时只能降级到同一域名的 HTTP 地址");
assert(httpFallbackBase("http://springhues.com") === null, "HTTP 地址不得重复降级");

for (const mutate of [
  (brief) => brief.mods.pop(),
  (brief) => { brief.news[1].title = brief.news[0].title; },
  (brief) => { brief.features[0].url = "http://example.com/story"; },
  (brief) => { brief.deals[0].image = "../secret.png"; },
  (brief) => { brief.news[0].date = "2025-01-01"; },
  (brief) => { brief.news[0].date = "2026-08-21"; },
  (brief) => { brief.cutoff = "2026-08-22 10:50（北京时间）"; },
  (brief) => { brief.news[0].summary = '<img src=x onerror="alert(1)">'; }
]) {
  const invalid = structuredClone(game);
  mutate(invalid);
  assertThrows(() => validateGame(invalid), "不合规游戏日报必须被拒绝");
}

const invalidCivic = structuredClone(civic);
invalidCivic.metrics = invalidCivic.metrics.filter((metric) => metric.kind !== "gold");
assertThrows(() => validateMinsheng(invalidCivic), "缺少必需指标的民生日报必须被拒绝");

const civicHtml = await readFile(path.join(root, "minsheng", "index.html"), "utf8");
assert(!/天气|weather/i.test(civicHtml), "民生日报页面不得包含天气区域");
for (const id of ["domesticStories", "internationalStories", "techStories", "aiStories", "archiveDate"]) {
  assert(civicHtml.includes(`id="${id}"`), `页面缺少 ${id}`);
}
assert(civicHtml.includes('href="mobile-fix.css'), "民生日报必须加载移动端布局修复样式");
assert(civicHtml.includes('id="downloadPng"') && civicHtml.includes("下载当天 PNG 原图"), "民生日报底部必须提供 PNG 原图下载按钮");
const mobileCss = await readFile(path.join(root, "minsheng", "mobile-fix.css"), "utf8");
assert(/position:\s*static/.test(mobileCss), "移动端栏目标题必须参与正常文档流，避免覆盖首条新闻");

const gameHtml = await readFile(path.join(root, "game", "index.html"), "utf8");
const portalHtml = await readFile(path.join(root, "index.html"), "utf8");
assert(!portalHtml.includes('class="promise"'), "首页不得显示仅概括民生日报的底部统计说明区");
assert(gameHtml.includes('<a href="./">首页</a>') && civicHtml.includes('<a href="../">首页</a>'), "双频道导航入口必须统一命名为首页");
assert(!gameHtml.includes("双频道首页") && !civicHtml.includes("双频道首页"), "频道导航不得继续显示双频道首页旧名称");
for (const sharedHeaderClass of ["site-bar", "mini-brand", "archive-trigger"]) {
  assert(civicHtml.includes(`class="${sharedHeaderClass}`) && gameHtml.includes(`class="${sharedHeaderClass}`), `双频道页头必须共用 ${sharedHeaderClass} 结构`);
}
assert(gameHtml.includes('<a class="active" href="game/">游戏日报</a>'), "游戏日报页头必须标记游戏频道为当前频道");
assert(gameHtml.includes('id="navDate"'), "游戏日报统一页头必须显示当前期次日期");
assert(gameHtml.includes('id="archiveDate"') && gameHtml.includes("按日期选择"), "游戏日报归档弹窗必须提供日期选择器");
assert(gameHtml.includes('id="downloadPng"') && gameHtml.includes("下载当天 PNG 原图"), "游戏日报底部必须提供 PNG 原图下载按钮");
assert(gameHtml.includes('class="hero-logo-stage"') && gameHtml.includes('src="brand-assets/springhues-logo.png"'), "游戏日报首屏必须展示 Springhues Logo");
assert(!gameHtml.includes('class="ticker"'), "游戏日报不得保留黑色滚动栏目条");
assert(!gameHtml.includes('id="headlines"'), "游戏日报不得恢复今日头条板块");
const platformOrder = ["store.steampowered.com", "store.epicgames.com", "www.mcmod.cn", "www.minebbs.com"];
let previousPlatformIndex = -1;
for (const platform of platformOrder) {
  const platformIndex = gameHtml.indexOf(platform);
  assert(platformIndex > previousPlatformIndex, `游戏平台快捷入口缺失或顺序错误：${platform}`);
  previousPlatformIndex = platformIndex;
}
assert(gameHtml.includes("<b>01</b> 中国玩家关注") && gameHtml.includes("<b>02</b> Minecraft 热门整合包"), "游戏日报正文板块必须从 01 开始编号");
assert(!gameHtml.includes(">报</span>") && !civicHtml.includes(">报</span>"), "双频道页头不得继续显示旧的报字标识");
assert(gameHtml.includes("brand-assets/springhues-logo.png") && civicHtml.includes("../brand-assets/springhues-logo.png"), "双频道页头必须使用唯一的 Springhues 正式 Logo");
await access(path.join(root, "brand-assets", "springhues-logo.png"));

const gameApp = await readFile(path.join(root, "app.js"), "utf8");
const civicApp = await readFile(path.join(root, "minsheng", "app.js"), "utf8");
assert(gameApp.includes("历史补档"), "游戏日报必须诚实标记后补的历史期次");
assert(!/\.innerHTML\s*=/.test(gameApp), "游戏页面不得使用 innerHTML 拼接日报数据");
assert(gameApp.includes("textContent") && gameApp.includes("replaceChildren"), "游戏页面必须使用安全 DOM API 渲染");
assert(gameApp.includes('parsed.protocol !== "https:"'), "游戏页面必须限制外链为 HTTPS");
assert(gameApp.includes("safeImage(item.image, item.name)"), "Minecraft 整合包必须渲染经过安全路径校验的封面");
for (const [name, app] of [["游戏", gameApp], ["民生", civicApp]]) {
  assert(app.includes('element("a", "archive-item")') || app.includes('document.createElement("a")'), `${name}归档必须使用可直接访问的日期链接`);
  assert(app.includes('url.searchParams.set("date", date)'), `${name}归档链接必须携带所选日期`);
  assert(app.includes('dataUrl.searchParams.set("edition", edition.date)'), `${name}日报数据请求必须按期次刷新缓存`);
  assert(app.includes('date !== edition.date'), `${name}日报必须拒绝正文日期与索引不匹配`);
  assert(app.includes("downloadPng.download"), `${name}日报必须按所选期次设置 PNG 下载文件名`);
}
assert(gameApp.includes("downloads/game/${encodeURIComponent(brief.date)}.png"), "游戏日报下载按钮必须跟随所选归档日期");
assert(gameApp.includes("edition.headline || edition.title"), "游戏日报归档列表必须显示每期具体头条");
assert(gameApp.includes('$("#archiveDate").min') && gameApp.includes('$("#archiveDate").max'), "游戏日报日期选择器必须限制在公开归档范围");
assert(gameApp.includes('addEventListener("change", (event) => navigateToDate(event.target.value))'), "游戏日报日期选择器必须支持按日期跳转");
assert(civicApp.includes("downloads/minsheng/${encodeURIComponent(brief.date)}.png"), "民生日报下载按钮必须跟随所选归档日期");
assert(gameHtml.includes("app.js?v=20260824-platform-links"), "游戏日报脚本必须使用快捷入口布局缓存版本");
assert(civicHtml.includes("app.js?v=20260824-download-png"), "民生日报脚本必须使用 PNG 下载缓存版本");

for (const file of ["index.html", "game/index.html", "minsheng/index.html", "portal.js", "minsheng/app.js", "scripts/game-lib.mjs"]) {
  await access(path.join(root, file));
}
console.log(`站点测试通过：动态校验 ${latestCivic.date} 民生日报与 ${latestGame.date} 游戏日报，发布时间、完整结构和安全渲染均有效。`);

async function readJson(file) { return JSON.parse(await readFile(path.join(root, file), "utf8")); }
async function assertPng(file, label) {
  const buffer = await readFile(file);
  assert(buffer.length > 24, `${label} PNG 文件不能为空`);
  assert(buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${label} 必须是有效 PNG`);
  assert(buffer.readUInt32BE(16) === 3840, `${label} PNG 宽度必须为 3840px`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function nextIsoDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function assertThrows(callback, message) {
  let rejected = false;
  try { callback(); } catch { rejected = true; }
  assert(rejected, message);
}
function isSorted(editions) { return editions.every((edition, index) => index === 0 || editions[index - 1].date >= edition.date); }
