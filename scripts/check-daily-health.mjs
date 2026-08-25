import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertGameArchiveConsistency, assertManifestEdition, assertMinshengArchiveConsistency } from "./archive-consistency.mjs";
import { beijingDate, validateGame } from "./game-lib.mjs";
import { httpFallbackBase, tlsCertificateCode } from "./health-lib.mjs";
import { validateMinsheng } from "./minsheng-lib.mjs";

const CHANNELS = {
  game: {
    label: "游戏日报",
    manifestFile: "data/index.json",
    pagePath: "game/",
    pngPath: (date) => `downloads/game/${date}.png`,
    validate: validateGame,
    assertDistinct: assertGameArchiveConsistency
  },
  minsheng: {
    label: "民生日报",
    manifestFile: "data/minsheng/index.json",
    pagePath: "minsheng/",
    pngPath: (date) => `downloads/minsheng/${date}.png`,
    validate: validateMinsheng,
    assertDistinct: assertMinshengArchiveConsistency
  }
};

export async function runDailyHealth({ root = process.cwd(), date = beijingDate(), liveBase, fetchImpl = fetch, checkedAt = new Date().toISOString() } = {}) {
  const normalizedLiveBase = liveBase?.replace(/\/$/, "");
  const result = {
    date,
    checkedAt,
    local: {},
    live: {},
    channels: {},
    reasonCodes: [],
    warnings: [],
    transport: normalizedLiveBase ? { requested: protocolName(normalizedLiveBase), effective: null } : null
  };

  for (const [channel, config] of Object.entries(CHANNELS)) {
    const local = await inspectLocalChannel(root, date, config);
    result.local[channel] = local;
    result.channels[channel] = { local };
    collectReasonCodes(result, "local", channel, local);
  }

  if (normalizedLiveBase) {
    for (const [channel, config] of Object.entries(CHANNELS)) {
      const live = await inspectLiveChannel(normalizedLiveBase, date, checkedAt, config, fetchImpl, result);
      result.live[channel] = live;
      result.channels[channel].live = live;
      collectReasonCodes(result, "live", channel, live);
    }
    const transports = new Set(Object.values(result.live).map((channel) => channel.transport).filter(Boolean));
    result.transport.effective = transports.has("http-fallback")
      ? "http-fallback"
      : transports.size === 1 ? [...transports][0] : transports.size ? "mixed" : "unavailable";
  }

  const groups = normalizedLiveBase ? [result.local, result.live] : [result.local];
  result.healthy = groups.every((group) => Object.values(group).every((channel) => channel.valid));
  result.degraded = result.warnings.length > 0;
  return result;
}

async function inspectLocalChannel(root, date, config) {
  const content = await component(async () => {
    const manifest = await readJson(path.join(root, config.manifestFile));
    const edition = manifest.editions.find((item) => item.date === date);
    if (!edition) throw codedError("CONTENT_MISSING", "当天归档记录不存在");
    if (edition.publishAt !== `${date}T11:00:00+08:00`) throw codedError("PUBLISH_TIME_MISMATCH", "发布时间不是北京时间11:00");
    const brief = await readJson(path.join(root, edition.file));
    config.validate(brief, { expectedDate: date });
    assertManifestEdition(edition, brief, config.label);
    const priorBriefs = await Promise.all(manifest.editions
      .filter((item) => item.date < date)
      .slice(0, 7)
      .map((item) => readJson(path.join(root, item.file))));
    config.assertDistinct(brief, priorBriefs);
    return { file: edition.file, issue: edition.issue };
  }, "CONTENT_INVALID");

  const png = await component(async () => {
    const file = path.join(root, config.pngPath(date));
    const buffer = await readFile(file);
    validatePng(buffer, config.label);
    return { file: config.pngPath(date), bytes: buffer.length, width: buffer.readUInt32BE(16) };
  }, "PNG_MISSING_OR_INVALID");

  const deployment = { valid: true, status: "local-filesystem" };
  return channelResult(content, png, deployment, "local");
}

async function inspectLiveChannel(base, date, checkedAt, config, fetchImpl, result) {
  try {
    await fetchOk(`${base}/?health=${encodeURIComponent(checkedAt)}`, fetchImpl);
    return inspectLiveAt(base, date, checkedAt, config, fetchImpl, protocolName(base));
  } catch (error) {
    const certificateCode = tlsCertificateCode(error);
    const fallbackBase = certificateCode && httpFallbackBase(base);
    if (!fallbackBase) return failedLiveChannel(error, "TRANSPORT_FAILED");
    const warning = `HTTPS 证书异常（${certificateCode}），已通过 HTTP 只读复核内容；不得据此重做日报或重触发部署`;
    if (!result.warnings.includes(warning)) result.warnings.push(warning);
    if (!result.reasonCodes.includes("TLS_CERTIFICATE_DEGRADED")) result.reasonCodes.push("TLS_CERTIFICATE_DEGRADED");
    try {
      return await inspectLiveAt(fallbackBase, date, checkedAt, config, fetchImpl, "http-fallback", warning);
    } catch (fallbackError) {
      return failedLiveChannel(codedError("TRANSPORT_FAILED", `HTTPS 证书异常（${certificateCode}），HTTP 复核也失败：${fallbackError.message}`), "TRANSPORT_FAILED");
    }
  }
}

async function inspectLiveAt(base, date, checkedAt, config, fetchImpl, transport, warning) {
  const stamp = encodeURIComponent(checkedAt);
  const deployment = await component(async () => {
    const response = await fetchOk(`${base}/${config.pagePath}?health=${stamp}`, fetchImpl);
    return { url: response.url || `${base}/${config.pagePath}`, status: response.status };
  }, "DEPLOYMENT_UNAVAILABLE");

  const content = await component(async () => {
    const manifest = await fetchJson(`${base}/${config.manifestFile}?health=${stamp}`, fetchImpl);
    const edition = manifest.editions.find((item) => item.date === date);
    if (!edition) throw codedError("CONTENT_MISSING", "线上当天归档记录不存在");
    if (edition.publishAt !== `${date}T11:00:00+08:00`) throw codedError("PUBLISH_TIME_MISMATCH", "线上发布时间不是北京时间11:00");
    const brief = await fetchJson(`${base}/${edition.file}?health=${stamp}`, fetchImpl);
    config.validate(brief, { expectedDate: date });
    assertManifestEdition(edition, brief, config.label);
    const priorBriefs = await Promise.all(manifest.editions
      .filter((item) => item.date < date)
      .slice(0, 7)
      .map((item) => fetchJson(`${base}/${item.file}?health=${stamp}`, fetchImpl)));
    config.assertDistinct(brief, priorBriefs);
    return { file: edition.file, issue: edition.issue };
  }, "CONTENT_INVALID");

  const png = await component(async () => {
    const url = `${base}/${config.pngPath(date)}?health=${stamp}`;
    // The 3840px game download can be several megabytes. Give the body enough
    // time to arrive while keeping page/JSON probes on the shorter timeout.
    const response = await fetchOk(url, fetchImpl, 60000);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/png")) throw codedError("PNG_CONTENT_TYPE_INVALID", `PNG Content-Type 无效：${contentType || "缺失"}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    validatePng(buffer, config.label);
    return { url, contentType, bytes: buffer.length, width: buffer.readUInt32BE(16) };
  }, "PNG_MISSING_OR_INVALID");

  return channelResult(content, png, deployment, transport, warning);
}

function channelResult(content, png, deployment, transport, warning) {
  const valid = content.valid && png.valid && deployment.valid;
  const reasons = [content, png, deployment].filter((item) => !item.valid).map((item) => item.reason);
  return {
    valid,
    file: content.file,
    reason: reasons.join("；") || undefined,
    content,
    png,
    deployment,
    transport,
    warning
  };
}

function failedLiveChannel(error, fallbackCode) {
  const failed = failure(error.code || fallbackCode, error.message);
  return channelResult(failed, failed, failed, "unavailable");
}

async function component(callback, fallbackCode) {
  try { return { valid: true, ...(await callback()) }; }
  catch (error) { return failure(error.code || fallbackCode, error.message); }
}

function failure(code, reason) {
  return { valid: false, code, reason };
}

function collectReasonCodes(result, scope, channel, value) {
  for (const [componentName, componentValue] of Object.entries({ content: value.content, png: value.png, deployment: value.deployment })) {
    if (!componentValue?.valid) {
      const code = `${scope}_${channel}_${componentName}_${componentValue.code || "INVALID"}`.toUpperCase();
      if (!result.reasonCodes.includes(code)) result.reasonCodes.push(code);
    }
  }
}

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

function validatePng(buffer, label) {
  if (buffer.length <= 24) throw codedError("PNG_EMPTY", `${label} PNG 文件不能为空`);
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw codedError("PNG_SIGNATURE_INVALID", `${label} 必须是有效 PNG`);
  const width = buffer.readUInt32BE(16);
  if (width !== 3840) throw codedError("PNG_WIDTH_INVALID", `${label} PNG 宽度必须为 3840px，当前为 ${width}px`);
}

function protocolName(base) {
  return new URL(base).protocol.slice(0, -1);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function fetchOk(url, fetchImpl, timeoutMs = 15000) {
  const response = await fetchImpl(url, {
    headers: { "cache-control": "no-cache" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw codedError(`HTTP_${response.status}`, `HTTP ${response.status}: ${url}`);
  return response;
}

async function fetchJson(url, fetchImpl) {
  return (await fetchOk(url, fetchImpl)).json();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dateArg = process.argv.find((arg) => arg.startsWith("--date="));
  const liveArg = process.argv.find((arg) => arg.startsWith("--live="));
  const save = process.argv.includes("--save");
  const date = dateArg?.slice("--date=".length) || beijingDate();
  const result = await runDailyHealth({
    root: process.cwd(),
    date,
    liveBase: liveArg?.slice("--live=".length)
  });
  if (save) {
    const directory = path.resolve(process.cwd(), "artifacts", "operations");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, `${date}-health.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.healthy) process.exitCode = 1;
}
