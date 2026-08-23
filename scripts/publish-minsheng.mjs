import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertPublishTime, beijingDate, safePendingPath, validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const date = beijingDate();
const { pending } = safePendingPath(root, date);
const dataDir = path.resolve(root, "data", "minsheng");
const target = path.resolve(dataDir, `${date}.json`);
if (path.dirname(target) !== dataDir) throw new Error("拒绝发布到非预期目录");
await access(pending).catch(() => { throw new Error(`${date} 民生日报草稿不存在，拒绝发布`); });
const brief = JSON.parse(await readFile(pending, "utf8"));
validateMinsheng(brief, { expectedDate: date });
assertPublishTime(date);
await mkdir(dataDir, { recursive: true });
await rename(pending, target);

const indexPath = path.join(dataDir, "index.json");
const manifest = JSON.parse(await readFile(indexPath, "utf8"));
const firstStoryId = brief.topStoryIds[0];
const headline = Object.values(brief.sections).flat().find((story) => story.id === firstStoryId)?.title || "每日35条精选新闻";
manifest.editions = manifest.editions.filter((edition) => edition.date !== date);
manifest.editions.push({
  date,
  issue: brief.issue,
  publishAt: `${date}T11:00:00+08:00`,
  title: "民生日报 · 每日35条精选新闻",
  headline,
  file: `data/minsheng/${date}.json`
});
manifest.editions.sort((a, b) => b.date.localeCompare(a.date));
await writeFile(indexPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`已发布 ${date} 民生日报。`);
