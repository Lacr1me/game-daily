import { access, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date());
const value = Object.fromEntries(parts.map(x => [x.type, x.value]));
const date = `${value.year}-${value.month}-${value.day}`;
const root = process.cwd();
const pending = path.join(root,"data",".pending",`${date}.json`);
const target = path.join(root,"data",`${date}.json`);

await access(pending).catch(() => { throw new Error(`${date} 草稿不存在，拒绝发布空日报`); });
const brief = JSON.parse(await readFile(pending,"utf8"));
for (const [key,count] of [["news",10],["packs",10],["mods",6],["deals",4]]) {
  if (brief[key]?.length !== count) throw new Error(`${key} 数量不合规，拒绝发布`);
}
await rename(pending,target);

const indexPath = path.join(root,"data","index.json");
const manifest = JSON.parse(await readFile(indexPath,"utf8"));
manifest.editions = manifest.editions.filter(x => x.date !== date);
manifest.editions.push({
  date,
  publishAt: `${date}T11:00:00+08:00`,
  title: "游戏与 Minecraft 每日简报",
  file: `data/${date}.json`
});
manifest.editions.sort((a,b) => b.date.localeCompare(a.date));
await writeFile(indexPath,`${JSON.stringify(manifest,null,2)}\n`,"utf8");
const briefs = {};
for (const edition of manifest.editions) {
  briefs[edition.date] = JSON.parse(await readFile(path.join(root,edition.file),"utf8"));
}
await writeFile(
  path.join(root,"data","embedded.js"),
  `globalThis.__GAME_BRIEF_ARCHIVE__ = ${JSON.stringify({manifest,briefs})};\n`,
  "utf8"
);
console.log(`已发布 ${date} 日报。`);
