import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateMinsheng } from "./minsheng-lib.mjs";

const file = process.argv[2];
if (!file) throw new Error("用法：node scripts/validate-minsheng.mjs <日报JSON>");
const fullPath = path.resolve(process.cwd(), file);
const brief = JSON.parse(await readFile(fullPath, "utf8"));
validateMinsheng(brief, { expectedDate: brief.date });
console.log(`校验通过：${brief.date}，共 ${Object.values(brief.sections).flat().length} 条新闻。`);
