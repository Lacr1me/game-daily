import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root,"data","index.json"),"utf8"));
const briefs = {};
for (const edition of manifest.editions) {
  briefs[edition.date] = JSON.parse(await readFile(path.join(root,edition.file),"utf8"));
}
await writeFile(
  path.join(root,"data","embedded.js"),
  `globalThis.__GAME_BRIEF_ARCHIVE__ = ${JSON.stringify({manifest,briefs})};\n`,
  "utf8"
);
console.log(`已构建 ${Object.keys(briefs).length} 期离线日报数据。`);
