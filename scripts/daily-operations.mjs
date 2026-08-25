import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
    audit: path.join(directory, `${date}-source-audit.json`)
  };
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
