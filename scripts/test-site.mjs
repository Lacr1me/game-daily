import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const civicPath = path.join(root, "data", "minsheng", "2026-08-23.json");
const civic = JSON.parse(await readFile(civicPath, "utf8"));
validateMinsheng(civic, { expectedDate: "2026-08-23" });
assert(Object.values(civic.sections).flat().length === 35, "首期必须包含35条新闻");
assert(civic.topStoryIds.length === 3, "首期必须包含3条正文引用式头条");

const civicManifest = JSON.parse(await readFile(path.join(root, "data", "minsheng", "index.json"), "utf8"));
const gameManifest = JSON.parse(await readFile(path.join(root, "data", "index.json"), "utf8"));
for (const [name, manifest] of [["民生", civicManifest], ["游戏", gameManifest]]) {
  assert(manifest.timezone === "Asia/Shanghai", `${name}频道时区必须为 Asia/Shanghai`);
  assert(new Set(manifest.editions.map((edition) => edition.date)).size === manifest.editions.length, `${name}归档日期不能重复`);
  assert(isSorted(manifest.editions), `${name}归档必须按日期倒序`);
}

const publishAt = civicManifest.editions[0].publishAt;
assert(new Date(publishAt).getTime() > new Date("2026-08-23T10:59:59+08:00").getTime(), "10:59:59 不得公开日报");
assert(new Date(publishAt).getTime() <= new Date("2026-08-23T11:00:00+08:00").getTime(), "11:00:00 必须允许公开日报");

const civicHtml = await readFile(path.join(root, "minsheng", "index.html"), "utf8");
assert(!/天气|weather/i.test(civicHtml), "民生日报页面不得包含天气区域");
for (const id of ["domesticStories", "internationalStories", "techStories", "aiStories", "archiveDate"]) assert(civicHtml.includes(`id="${id}"`), `页面缺少 ${id}`);

const invalid = structuredClone(civic);
invalid.metrics = invalid.metrics.filter((metric) => metric.kind !== "gold");
let rejected = false;
try { validateMinsheng(invalid); } catch { rejected = true; }
assert(rejected, "缺少必需指标的数据必须被拒绝");

for (const file of ["index.html", "game/index.html", "minsheng/index.html", "portal.js", "minsheng/app.js"]) await access(path.join(root, file));
console.log("站点测试通过：双频道入口、35条民生数据、发布时间门槛、归档和失败校验均有效。");

function assert(condition, message) { if (!condition) throw new Error(message); }
function isSorted(editions) { return editions.every((edition, index) => index === 0 || editions[index - 1].date >= edition.date); }
