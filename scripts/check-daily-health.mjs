import { readFile } from "node:fs/promises";
import path from "node:path";
import { beijingDate, validateGame } from "./game-lib.mjs";
import { validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
const liveArg = process.argv.find((arg) => arg.startsWith("--live="));
const date = dateArg?.slice("--date=".length) || beijingDate();
const liveBase = liveArg?.slice("--live=".length).replace(/\/$/, "");
const result = { date, checkedAt: new Date().toISOString(), local: {}, live: {} };

await inspectLocal("game", "data/index.json", validateGame);
await inspectLocal("minsheng", "data/minsheng/index.json", validateMinsheng);
if (liveBase) {
  await inspectLive("game", "data/index.json", validateGame);
  await inspectLive("minsheng", "data/minsheng/index.json", validateMinsheng);
}

const groups = liveBase ? [result.local, result.live] : [result.local];
result.healthy = groups.every((group) => Object.values(group).every((channel) => channel.valid));
console.log(JSON.stringify(result, null, 2));
if (!result.healthy) process.exitCode = 1;

async function inspectLocal(channel, manifestFile, validate) {
  try {
    const manifest = await readJson(path.join(root, manifestFile));
    const edition = manifest.editions.find((item) => item.date === date);
    if (!edition) throw new Error("当天归档记录不存在");
    if (edition.publishAt !== `${date}T11:00:00+08:00`) throw new Error("发布时间不是北京时间11:00");
    const brief = await readJson(path.join(root, edition.file));
    validate(brief, { expectedDate: date });
    result.local[channel] = { valid: true, file: edition.file };
  } catch (error) {
    result.local[channel] = { valid: false, reason: error.message };
  }
}

async function inspectLive(channel, manifestFile, validate) {
  try {
    const stamp = encodeURIComponent(result.checkedAt);
    const manifest = await fetchJson(`${liveBase}/${manifestFile}?health=${stamp}`);
    const edition = manifest.editions.find((item) => item.date === date);
    if (!edition) throw new Error("线上当天归档记录不存在");
    const brief = await fetchJson(`${liveBase}/${edition.file}?health=${stamp}`);
    validate(brief, { expectedDate: date });
    result.live[channel] = { valid: true, file: edition.file };
  } catch (error) {
    result.live[channel] = { valid: false, reason: error.message };
  }
}

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function fetchJson(url) {
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}
