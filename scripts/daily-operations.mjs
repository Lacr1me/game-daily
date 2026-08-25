import { createHash } from "node:crypto";
import { appendFile, mkdir, open, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { beijingDate } from "./game-lib.mjs";
import { SOURCE_REGISTRY, canonicalSourceId, canonicalSourceLabel, channelSections, requiredSourceIds } from "./source-registry.mjs";

export const LEDGER_STATUSES = new Set(["started", ...SOURCE_REGISTRY.terminalStatuses]);

export function operationPaths(root, date) {
  assertDate(date);
  const directory = path.resolve(root, "artifacts", "operations");
  return {
    directory,
    state: path.join(directory, `${date}-run-state.json`),
    ledger: path.join(directory, `${date}-research-ledger.jsonl`),
    audit: path.join(directory, `${date}-source-audit.json`),
    lease: path.join(directory, `${date}-run-lease.json`),
    readiness: path.join(directory, `${date}-readiness.json`)
  };
}

export async function acquireRunLease(root, options = {}) {
  const date = options.date || beijingDate();
  const runId = requiredText(options.runId, "runId");
  const ttlSeconds = Number(options.ttlSeconds ?? 3300);
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 7200) throw new Error("租约时长必须为60—7200秒");
  const paths = operationPaths(root, date);
  await mkdir(paths.directory, { recursive: true });
  const now = Date.now();
  const lease = {
    schemaVersion: 1,
    date,
    runId,
    acquiredAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString()
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(paths.lease, "wx");
      try { await handle.writeFile(`${JSON.stringify(lease, null, 2)}\n`, "utf8"); }
      finally { await handle.close(); }
      return { acquired: true, lease };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existing = await readLeaseIfExists(paths.lease);
      if (existing?.runId === runId && Date.parse(existing.expiresAt) > now) {
        await writeJson(paths.lease, lease);
        return { acquired: true, reused: true, renewed: true, lease };
      }
      if (!existing || Date.parse(existing.expiresAt) <= now) {
        await unlink(paths.lease).catch((unlinkError) => { if (unlinkError.code !== "ENOENT") throw unlinkError; });
        continue;
      }
      return { acquired: false, reason: "active-lease", lease: existing };
    }
  }
  return { acquired: false, reason: "lease-race" };
}

export async function releaseRunLease(root, options = {}) {
  const date = options.date || beijingDate();
  const runId = requiredText(options.runId, "runId");
  const paths = operationPaths(root, date);
  const existing = await readLeaseIfExists(paths.lease);
  if (!existing) return { released: false, reason: "missing" };
  if (existing.runId !== runId && Date.parse(existing.expiresAt) > Date.now()) {
    throw new Error(`运行 ${runId} 不能释放 ${existing.runId} 的有效租约`);
  }
  await unlink(paths.lease).catch((error) => { if (error.code !== "ENOENT") throw error; });
  return { released: true, lease: existing };
}

export async function createReadyProof(root, options = {}) {
  const date = options.date || beijingDate();
  const channel = requiredChannel(options.channel);
  const paths = operationPaths(root, date);
  const expected = expectedArtifactPaths(root, date, channel);
  const candidate = requireExactPath(options.candidate, expected.candidate, "候选JSON");
  const publicPng = requireExactPath(options.publicPng, expected.publicPng, "公开PNG");
  const renderDirectory = path.resolve(root, "artifacts", "operations", `${date}-render`);
  const html = requireInsidePath(options.html, renderDirectory, "渲染HTML");
  const renderPng = requireInsidePath(options.png, renderDirectory, "渲染PNG");
  const [candidateBuffer, htmlBuffer, renderPngBuffer, publicPngBuffer] = await Promise.all([
    readFile(candidate), readFile(html), readFile(renderPng), readFile(publicPng)
  ]);
  const brief = JSON.parse(candidateBuffer.toString("utf8"));
  if (brief.date !== date) throw new Error(`${channel}候选日期 ${brief.date} 与 ${date} 不一致`);
  validatePng3840(renderPngBuffer, "渲染PNG");
  validatePng3840(publicPngBuffer, "公开PNG");
  const renderPngSha256 = sha256(renderPngBuffer);
  const publicPngSha256 = sha256(publicPngBuffer);
  if (renderPngSha256 !== publicPngSha256) throw new Error(`${channel}公开PNG与统一渲染PNG不一致`);
  const htmlText = htmlBuffer.toString("utf8");
  const expectedHref = channel === "game" ? `downloads/game/${date}.png` : `../downloads/minsheng/${date}.png`;
  if (!htmlText.includes(date) || !htmlText.includes(expectedHref)) throw new Error(`${channel}渲染HTML的日期或下载链接不一致`);
  const readiness = await readJsonIfExists(paths.readiness) || { schemaVersion: 1, date, channels: {} };
  if (readiness.date !== date) throw new Error(`就绪证明日期 ${readiness.date} 与 ${date} 不一致`);
  readiness.channels[channel] = {
    candidate: path.relative(root, candidate).replaceAll("\\", "/"),
    candidateSha256: sha256(candidateBuffer),
    html: path.relative(root, html).replaceAll("\\", "/"),
    htmlSha256: sha256(htmlBuffer),
    renderPng: path.relative(root, renderPng).replaceAll("\\", "/"),
    publicPng: path.relative(root, publicPng).replaceAll("\\", "/"),
    pngSha256: renderPngSha256,
    width: 3840,
    verifiedAt: new Date().toISOString()
  };
  await writeJson(paths.readiness, readiness);
  await checkpointRunState(root, date, { stage: "ready", channel, status: "ready", published: false, missingSections: [] });
  return readiness.channels[channel];
}

export async function assertReadyProof(root, date, channel) {
  requiredChannel(channel);
  const paths = operationPaths(root, date);
  const [state, readiness] = await Promise.all([readJsonIfExists(paths.state), readJsonIfExists(paths.readiness)]);
  if (state?.channels?.[channel]?.status !== "ready") throw new Error(`${date} ${channel} 尚未标记为ready，拒绝发布`);
  const proof = readiness?.channels?.[channel];
  if (!proof) throw new Error(`${date} ${channel} 缺少就绪证明，拒绝发布`);
  const expected = expectedArtifactPaths(root, date, channel);
  const files = {
    candidate: requireExactPath(path.resolve(root, proof.candidate), expected.candidate, "候选JSON"),
    publicPng: requireExactPath(path.resolve(root, proof.publicPng), expected.publicPng, "公开PNG"),
    html: requireInsidePath(path.resolve(root, proof.html), path.resolve(root, "artifacts", "operations", `${date}-render`), "渲染HTML"),
    renderPng: requireInsidePath(path.resolve(root, proof.renderPng), path.resolve(root, "artifacts", "operations", `${date}-render`), "渲染PNG")
  };
  const [candidateBuffer, htmlBuffer, renderPngBuffer, publicPngBuffer] = await Promise.all([
    readFile(files.candidate), readFile(files.html), readFile(files.renderPng), readFile(files.publicPng)
  ]);
  validatePng3840(renderPngBuffer, "渲染PNG");
  validatePng3840(publicPngBuffer, "公开PNG");
  if (sha256(candidateBuffer) !== proof.candidateSha256 || sha256(htmlBuffer) !== proof.htmlSha256) throw new Error(`${channel}候选或HTML在就绪后被修改`);
  if (sha256(renderPngBuffer) !== proof.pngSha256 || sha256(publicPngBuffer) !== proof.pngSha256) throw new Error(`${channel}PNG在就绪后被修改`);
  return proof;
}

export async function initializeRunState(root, options = {}) {
  const date = options.date || beijingDate();
  const paths = operationPaths(root, date);
  await mkdir(paths.directory, { recursive: true });
  const existing = await readJsonIfExists(paths.state);
  const now = new Date().toISOString();
  const runId = options.runId || `${date}-${now.slice(11, 16).replace(":", "")}-${options.kind || "main"}`;
  const state = existing || {
    schemaVersion: 1,
    date,
    stage: "research",
    createdAt: now,
    channels: {
      minsheng: { issue: options.minshengIssue ?? null, status: "pending", missingSections: channelSections("minsheng"), published: false },
      game: { issue: options.gameIssue ?? null, status: "pending", missingSections: channelSections("game"), published: false }
    },
    runs: []
  };
  if (state.date !== date) throw new Error(`运行状态日期 ${state.date} 与 ${date} 不一致`);
  if (!state.runs.some((run) => run.id === runId)) {
    state.runs.push({ id: runId, kind: options.kind || "main", startedAt: now, status: "running" });
  }
  state.lastCheckpointAt = now;
  await writeJson(paths.state, state);
  return state;
}

export async function checkpointRunState(root, date, update = {}) {
  const paths = operationPaths(root, date);
  const state = await readJsonIfExists(paths.state);
  if (!state) throw new Error(`${date} 运行状态不存在，请先执行 init`);
  if (update.stage) state.stage = update.stage;
  if (update.channel) {
    if (!state.channels?.[update.channel]) throw new Error(`未知频道：${update.channel}`);
    const channel = state.channels[update.channel];
    if (update.status) channel.status = update.status;
    if (update.published !== undefined) channel.published = Boolean(update.published);
    if (update.issue !== undefined) channel.issue = update.issue;
    if (update.missingSections) channel.missingSections = [...new Set(update.missingSections)];
  }
  if (update.runId) {
    const run = state.runs.find((item) => item.id === update.runId);
    if (!run) throw new Error(`运行 ${update.runId} 不存在`);
    if (update.runStatus) run.status = update.runStatus;
    if (["complete", "failed"].includes(update.runStatus)) run.finishedAt = new Date().toISOString();
  }
  state.lastCheckpointAt = new Date().toISOString();
  await writeJson(paths.state, state);
  return state;
}

export async function appendResearchLedger(root, rawEntry) {
  const date = rawEntry.date || beijingDate();
  const paths = operationPaths(root, date);
  const sourceId = canonicalSourceId(rawEntry.sourceId || rawEntry.source);
  if (!sourceId) throw new Error(`来源不在注册表中：${rawEntry.sourceId || rawEntry.source}`);
  if (!SOURCE_REGISTRY.requirements?.[rawEntry.channel]?.[rawEntry.section]?.includes(sourceId)) {
    throw new Error(`来源 ${sourceId} 不属于 ${rawEntry.channel}/${rawEntry.section}`);
  }
  if (!LEDGER_STATUSES.has(rawEntry.status)) throw new Error(`无效检索状态：${rawEntry.status}`);
  if (rawEntry.url && !isHttps(rawEntry.url)) throw new Error("检索账本 URL 必须使用 HTTPS");
  const entry = {
    schemaVersion: 1,
    date,
    runId: requiredText(rawEntry.runId, "runId"),
    channel: rawEntry.channel,
    section: rawEntry.section,
    sourceId,
    source: SOURCE_REGISTRY.sources[sourceId].label,
    tier: rawEntry.tier || "primary",
    url: rawEntry.url || "",
    attemptedAt: rawEntry.attemptedAt || new Date().toISOString(),
    status: rawEntry.status,
    availableCount: nonNegativeInteger(rawEntry.availableCount),
    rejectedCount: nonNegativeInteger(rawEntry.rejectedCount),
    reasons: normalizeReasons(rawEntry.reasons),
    candidateIds: normalizeStringList(rawEntry.candidateIds)
  };
  await mkdir(paths.directory, { recursive: true });
  await appendFile(paths.ledger, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export async function readResearchLedger(root, date) {
  const { ledger } = operationPaths(root, date);
  const text = await readFile(ledger, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`检索账本第 ${index + 1} 行不是有效 JSON`); }
  });
}

export async function researchCompleteness(root, date, channel) {
  const ledger = await readResearchLedger(root, date);
  const sections = {};
  let complete = true;
  for (const section of channelSections(channel)) {
    const required = requiredSourceIds(channel, section);
    const missing = [];
    const incomplete = [];
    for (const sourceId of required) {
      const attempts = ledger.filter((entry) => entry.date === date && entry.channel === channel && entry.section === section && canonicalSourceId(entry.sourceId || entry.source) === sourceId);
      const terminal = attempts.filter((entry) => SOURCE_REGISTRY.terminalStatuses.includes(entry.status));
      if (!attempts.length) missing.push(sourceId);
      else if (!terminal.length) incomplete.push(sourceId);
      else if (terminal.at(-1).status === "unavailable" && terminal.filter((entry) => entry.status === "unavailable").length < SOURCE_REGISTRY.minimumUnavailableAttempts) incomplete.push(sourceId);
    }
    const sectionComplete = !missing.length && !incomplete.length;
    sections[section] = {
      complete: sectionComplete,
      missing: missing.map((id) => SOURCE_REGISTRY.sources[id].label),
      incomplete: incomplete.map((id) => SOURCE_REGISTRY.sources[id].label)
    };
    complete &&= sectionComplete;
  }
  return { date, channel, complete, sections };
}

export async function assertResearchComplete(root, date, channel) {
  const status = await researchCompleteness(root, date, channel);
  if (!status.complete) {
    const details = Object.entries(status.sections)
      .filter(([, section]) => !section.complete)
      .map(([name, section]) => `${name}: 未尝试 ${section.missing.join("、") || "无"}; 未完成 ${section.incomplete.join("、") || "无"}`);
    throw new Error(`${date} ${channel} 检索账本未完成：\n- ${details.join("\n- ")}`);
  }
  return status;
}

export async function mergeSourceAudits(root, date) {
  const paths = operationPaths(root, date);
  const names = await readdir(paths.directory).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const pattern = new RegExp(`^${date}-(\\d{4}|[A-Za-z0-9_-]+)-source-audit\\.json$`);
  const files = names.filter((name) => pattern.test(name)).sort();
  if (!files.length) {
    const existing = await readJsonIfExists(paths.audit);
    if (existing) return existing;
    throw new Error(`${date} 没有可合并的分次来源审计`);
  }
  const audits = await Promise.all(files.map((name) => readJsonIfExists(path.join(paths.directory, name))));
  const latest = audits.at(-1);
  const categories = {};
  for (const section of channelSections("minsheng").filter((name) => name !== "metrics")) {
    categories[section] = mergeAuditEntries(audits.map((audit) => audit?.categories?.[section]).filter(Boolean));
  }
  const merged = {
    date,
    sourcePolicyVersion: 2,
    status: latest?.status || "in-progress",
    runs: files.map((file, index) => ({ file, status: audits[index]?.status || "unknown" })),
    categories,
    metrics: mergeAuditEntries(audits.map((audit) => audit?.metrics).filter(Boolean))
  };
  await writeJson(paths.audit, merged);
  return merged;
}

function mergeAuditEntries(entries) {
  if (!entries.length) return null;
  const latest = entries.at(-1);
  return {
    attemptedChinaSources: [...new Set(entries.flatMap((entry) => entry.attemptedChinaSources || []).map(canonicalSourceLabel))],
    usableChinaCandidates: Math.max(0, ...entries.map((entry) => Number.isInteger(entry.usableChinaCandidates) ? entry.usableChinaCandidates : 0)),
    rejectedChinaCandidates: Math.max(0, ...entries.map((entry) => Number.isInteger(entry.rejectedChinaCandidates) ? entry.rejectedChinaCandidates : 0)),
    rejectionReasons: [...new Set(entries.flatMap((entry) => entry.rejectionReasons || []).filter(Boolean))],
    shortageReason: [...entries].reverse().find((entry) => String(entry.shortageReason || "").trim())?.shortageReason || "",
    finalChinaCount: latest.finalChinaCount,
    finalExternalCount: latest.finalExternalCount
  };
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readLeaseIfExists(file) {
  try {
    const text = await readFile(file, "utf8");
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function assertDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) throw new Error("日期必须为 YYYY-MM-DD");
}

function requiredText(value, field) {
  if (!String(value || "").trim()) throw new Error(`${field} 不能为空`);
  return String(value).trim();
}

function requiredChannel(value) {
  if (!["game", "minsheng"].includes(value)) throw new Error(`未知频道：${value}`);
  return value;
}

function expectedArtifactPaths(root, date, channel) {
  return {
    candidate: path.resolve(root, "data", ".pending", ...(channel === "minsheng" ? ["minsheng", `${date}.json`] : [`${date}.json`])),
    publicPng: path.resolve(root, "downloads", channel, `${date}.png`)
  };
}

function requireExactPath(value, expected, label) {
  const resolved = path.resolve(requiredText(value, label));
  if (resolved !== path.resolve(expected)) throw new Error(`${label}必须为 ${expected}`);
  return resolved;
}

function requireInsidePath(value, directory, label) {
  const resolved = path.resolve(requiredText(value, label));
  const relative = path.relative(path.resolve(directory), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label}必须位于 ${directory} 内`);
  return resolved;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validatePng3840(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length <= 24 || !buffer.subarray(0, 8).equals(signature)) throw new Error(`${label}不是有效PNG`);
  if (buffer.readUInt32BE(16) !== 3840) throw new Error(`${label}宽度必须为3840px`);
}

function nonNegativeInteger(value) {
  const number = Number(value ?? 0);
  if (!Number.isInteger(number) || number < 0) throw new Error("候选数量必须为非负整数");
  return number;
}

function normalizeReasons(value) {
  if (Array.isArray(value)) return normalizeStringList(value);
  return value ? [String(value).trim()].filter(Boolean) : [];
}

function normalizeStringList(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : String(value).split("|");
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function isHttps(value) {
  try { return new URL(value).protocol === "https:"; }
  catch { return false; }
}
