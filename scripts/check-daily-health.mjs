import { readFile } from "node:fs/promises";
import path from "node:path";
import { beijingDate, validateGame } from "./game-lib.mjs";
import { httpFallbackBase, tlsCertificateCode } from "./health-lib.mjs";
import { validateMinsheng } from "./minsheng-lib.mjs";

const root = process.cwd();
const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
const liveArg = process.argv.find((arg) => arg.startsWith("--live="));
const date = dateArg?.slice("--date=".length) || beijingDate();
const liveBase = liveArg?.slice("--live=".length).replace(/\/$/, "");
const result = { date, checkedAt: new Date().toISOString(), local: {}, live: {}, warnings: [] };

await inspectLocal("game", "data/index.json", validateGame);
await inspectLocal("minsheng", "data/minsheng/index.json", validateMinsheng);
if (liveBase) {
  await inspectLive("game", "data/index.json", validateGame);
  await inspectLive("minsheng", "data/minsheng/index.json", validateMinsheng);
}

const groups = liveBase ? [result.local, result.live] : [result.local];
result.healthy = groups.every((group) => Object.values(group).every((channel) => channel.valid));
result.degraded = result.warnings.length > 0;
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
    result.live[channel] = await inspectLiveAt(liveBase, manifestFile, validate);
  } catch (error) {
    const certificateCode = tlsCertificateCode(error);
    const fallbackBase = certificateCode && httpFallbackBase(liveBase);
    if (!fallbackBase) {
      result.live[channel] = { valid: false, reason: error.message };
      return;
    }
    try {
      const fallback = await inspectLiveAt(fallbackBase, manifestFile, validate);
      const warning = `HTTPS 证书异常（${certificateCode}），已通过 HTTP 只读复核内容；不得据此重做日报或重触发部署`;
      result.live[channel] = { ...fallback, transport: "http-fallback", warning };
      if (!result.warnings.includes(warning)) result.warnings.push(warning);
    } catch (fallbackError) {
      result.live[channel] = {
        valid: false,
        reason: `HTTPS 证书异常（${certificateCode}），HTTP 复核也失败：${fallbackError.message}`
      };
    }
  }
}

async function inspectLiveAt(base, manifestFile, validate) {
  const stamp = encodeURIComponent(result.checkedAt);
  const manifest = await fetchJson(`${base}/${manifestFile}?health=${stamp}`);
  const edition = manifest.editions.find((item) => item.date === date);
  if (!edition) throw new Error("线上当天归档记录不存在");
  if (edition.publishAt !== `${date}T11:00:00+08:00`) throw new Error("线上发布时间不是北京时间11:00");
  const brief = await fetchJson(`${base}/${edition.file}?health=${stamp}`);
  validate(brief, { expectedDate: date });
  return { valid: true, file: edition.file, transport: new URL(base).protocol.slice(0, -1) };
}

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function fetchJson(url) {
  const response = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}
