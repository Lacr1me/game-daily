import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertPublishTime as assertGamePublishTime, beijingDate, validateGame } from "./game-lib.mjs";
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
  assert(isSorted(manifest.editions), `${name}归档必须按日期倒序`);
  for (const edition of manifest.editions) {
    assert(edition.publishAt === `${edition.date}T11:00:00+08:00`, `${name} ${edition.date} 发布时间必须为北京时间11:00`);
    assert(new Date(edition.publishAt).getTime() <= Date.now(), `${name} ${edition.date} 尚未到发布时间，不得进入公开归档`);
    await access(path.join(root, edition.file));
  }
}

const latestCivic = civicManifest.editions[0];
const civic = await readJson(latestCivic.file);
validateMinsheng(civic, { expectedDate: latestCivic.date });
assert(Object.values(civic.sections).flat().length === 35, "最新民生日报必须包含35条新闻");
assert(civic.topStoryIds.length === 3, "最新民生日报必须包含3条正文引用式头条");

const latestGame = gameManifest.editions[0];
const game = await readJson(latestGame.file);
validateGame(game, { expectedDate: latestGame.date });
assert(latestGame.date <= beijingDate(), "最新游戏日报日期不得晚于北京时间当天");

assertThrows(() => assertGamePublishTime("2026-08-24", new Date("2026-08-24T10:59:59+08:00")), "游戏日报必须拒绝11:00前发布");
assertThrows(() => assertMinshengPublishTime("2026-08-24", new Date("2026-08-24T10:59:59+08:00")), "民生日报必须拒绝11:00前发布");
assertGamePublishTime("2026-08-24", new Date("2026-08-24T11:00:00+08:00"));
assertMinshengPublishTime("2026-08-24", new Date("2026-08-24T11:00:00+08:00"));

for (const mutate of [
  (brief) => brief.mods.pop(),
  (brief) => { brief.news[1].title = brief.news[0].title; },
  (brief) => { brief.features[0].url = "http://example.com/story"; },
  (brief) => { brief.deals[0].image = "../secret.png"; },
  (brief) => { brief.news[0].date = "2025-01-01"; },
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
assert(civicHtml.includes('href="mobile-fix.css"'), "民生日报必须加载移动端布局修复样式");
const mobileCss = await readFile(path.join(root, "minsheng", "mobile-fix.css"), "utf8");
assert(/position:\s*static/.test(mobileCss), "移动端栏目标题必须参与正常文档流，避免覆盖首条新闻");

const gameHtml = await readFile(path.join(root, "game", "index.html"), "utf8");
for (const sharedHeaderClass of ["site-bar", "mini-brand", "archive-trigger"]) {
  assert(civicHtml.includes(`class="${sharedHeaderClass}`) && gameHtml.includes(`class="${sharedHeaderClass}`), `双频道页头必须共用 ${sharedHeaderClass} 结构`);
}
assert(gameHtml.includes('<a class="active" href="game/">游戏日报</a>'), "游戏日报页头必须标记游戏频道为当前频道");
assert(gameHtml.includes('id="navDate"'), "游戏日报统一页头必须显示当前期次日期");
assert(!gameHtml.includes(">报</span>") && !civicHtml.includes(">报</span>"), "双频道页头不得继续显示旧的报字标识");
assert(gameHtml.includes("brand-assets/springhues-logo.png") && civicHtml.includes("../brand-assets/springhues-logo.png"), "双频道页头必须使用 Springhues 个人 Logo");
await access(path.join(root, "brand-assets", "springhues-logo.png"));

const gameApp = await readFile(path.join(root, "app.js"), "utf8");
assert(!/\.innerHTML\s*=/.test(gameApp), "游戏页面不得使用 innerHTML 拼接日报数据");
assert(gameApp.includes("textContent") && gameApp.includes("replaceChildren"), "游戏页面必须使用安全 DOM API 渲染");
assert(gameApp.includes('parsed.protocol !== "https:"'), "游戏页面必须限制外链为 HTTPS");

for (const file of ["index.html", "game/index.html", "minsheng/index.html", "portal.js", "minsheng/app.js", "scripts/game-lib.mjs"]) {
  await access(path.join(root, file));
}
console.log(`站点测试通过：动态校验 ${latestCivic.date} 民生日报与 ${latestGame.date} 游戏日报，发布时间、完整结构和安全渲染均有效。`);

async function readJson(file) { return JSON.parse(await readFile(path.join(root, file), "utf8")); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function assertThrows(callback, message) {
  let rejected = false;
  try { callback(); } catch { rejected = true; }
  assert(rejected, message);
}
function isSorted(editions) { return editions.every((edition, index) => index === 0 || editions[index - 1].date >= edition.date); }
