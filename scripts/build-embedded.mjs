import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateGame } from "./game-lib.mjs";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root,"data","index.json"),"utf8"));
const briefs = {};
for (const edition of manifest.editions) {
  const brief = JSON.parse(await readFile(path.join(root,edition.file),"utf8"));
  validateGame(brief, { expectedDate: edition.date });
  briefs[edition.date] = brief;
}
await writeFile(
  path.join(root,"data","embedded.js"),
  `globalThis.__GAME_BRIEF_ARCHIVE__ = ${JSON.stringify({manifest,briefs})};\n`,
  "utf8"
);
console.log(`已构建 ${Object.keys(briefs).length} 期离线日报数据。`);
