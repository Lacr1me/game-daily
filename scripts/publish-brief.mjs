import { access, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertGamePublishCandidate } from "./archive-consistency.mjs";
import { assertReadyProof, assertResearchComplete, checkpointRunState } from "./daily-operations.mjs";
import { assertPublishTime, beijingDate, safePendingPath, validateGame } from "./game-lib.mjs";

const date = beijingDate();
const root = process.cwd();
const { pending } = safePendingPath(root, date);
const target = path.join(root,"data",`${date}.json`);

await access(pending).catch(() => { throw new Error(`${date} 草稿不存在，拒绝发布空日报`); });
const brief = JSON.parse(await readFile(pending,"utf8"));
validateGame(brief, { expectedDate: date });
await assertResearchComplete(root, date, "game");
await assertReadyProof(root, date, "game");
assertPublishTime(date);

const indexPath = path.join(root,"data","index.json");
const manifest = JSON.parse(await readFile(indexPath,"utf8"));
const priorBriefs = await Promise.all(manifest.editions.map((edition) => readJson(path.join(root, edition.file))));
assertGamePublishCandidate(brief, manifest, priorBriefs);
await checkpointRunState(root, date, { stage: "publish", channel: "game", status: "publishing" });
await rename(pending,target);
manifest.editions = manifest.editions.filter(x => x.date !== date);
manifest.editions.push({
  date,
  issue: brief.issue,
  publishAt: `${date}T11:00:00+08:00`,
  title: "游戏与 Minecraft 每日简报",
  headline: brief.features?.[0]?.title || "今日游戏与方块世界",
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
await checkpointRunState(root, date, { stage: "published", channel: "game", status: "published", published: true, missingSections: [] });
console.log(`已发布 ${date} 日报。`);

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
