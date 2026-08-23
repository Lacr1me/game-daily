import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { assertGameArchiveConsistency, assertManifestEdition, assertMinshengArchiveConsistency } from "./archive-consistency.mjs";
import { validateGame } from "./game-lib.mjs";
import { validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const output = path.join(root, "dist");
for (const file of ["index.html", "portal.js", "app.js", "game/index.html", "minsheng/index.html", "brand-assets/springhues-logo.png", "data/index.json", "data/minsheng/index.json", ".nojekyll"]) {
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

const civicBriefs = [];
for (const edition of civicManifest.editions) {
  const brief = await readJson(path.join(output, edition.file));
  validateMinsheng(brief, { expectedDate: edition.date });
  assertManifestEdition(edition, brief, "民生日报");
  civicBriefs.push(brief);
}
for (const brief of civicBriefs) assertMinshengArchiveConsistency(brief, civicBriefs);
console.log("构建产物验证通过：公开文件完整，草稿已排除，双频道归档数据有效。");

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
