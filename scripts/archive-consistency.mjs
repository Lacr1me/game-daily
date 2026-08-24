export const GAME_DUPLICATE_LIMITS = {
  features: 0,
  news: 2,
  packs: 5,
  mods: 4,
  deals: 16,
  trends: 1
};

export const MINSHENG_DUPLICATE_LIMIT = 10;

export function assertGameArchiveConsistency(candidate, priorBriefs) {
  for (const prior of recentPriorBriefs(candidate, priorBriefs)) {
    for (const [section, limit] of Object.entries(GAME_DUPLICATE_LIMITS)) {
      const repeated = repeatedItems(candidate[section], prior[section]);
      if (repeated.length > limit) {
        throw new Error(`${candidate.date} 与 ${prior.date} 游戏日报 ${section} 重复 ${repeated.length} 条，超过上限 ${limit}：${repeated.join("、")}`);
      }
    }
  }
}

export function assertMinshengArchiveConsistency(candidate, priorBriefs) {
  const candidateStories = allMinshengStories(candidate);
  for (const prior of recentPriorBriefs(candidate, priorBriefs)) {
    const repeated = repeatedItems(candidateStories, allMinshengStories(prior));
    if (repeated.length > MINSHENG_DUPLICATE_LIMIT) {
      throw new Error(`${candidate.date} 与 ${prior.date} 民生日报重复 ${repeated.length} 条，超过上限 ${MINSHENG_DUPLICATE_LIMIT}：${repeated.join("、")}`);
    }
  }
}

export function assertGamePublishCandidate(candidate, manifest, priorBriefs) {
  assertNextEdition(candidate, manifest, "游戏日报");
  assertFieldDate(candidate.cutoff, candidate.date, "游戏日报 cutoff");
  const previousDate = previousIsoDate(candidate.date);
  if (!candidate.dataWindow.includes(candidate.date) || !candidate.dataWindow.includes(previousDate)) {
    throw new Error(`游戏日报 dataWindow 必须同时包含 ${previousDate} 和 ${candidate.date}`);
  }
  if (!Array.isArray(candidate.deals) || candidate.deals.length < 6 || candidate.deals.length > 24) {
    throw new Error("新发布游戏日报的 Steam 优惠必须为 6—24 款");
  }
  for (const item of [...candidate.features, ...candidate.news, ...candidate.packs, ...candidate.deals]) {
    const basename = String(item.image || "").split("/").pop();
    if (!basename.startsWith(`${candidate.date}-`)) {
      throw new Error(`游戏日报新期次配图必须使用当天独立文件名：${item.image}`);
    }
  }
  assertGameArchiveConsistency(candidate, priorBriefs);
}

export function assertMinshengPublishCandidate(candidate, manifest, priorBriefs) {
  assertNextEdition(candidate, manifest, "民生日报");
  for (const [field, value] of [["cutoff", candidate.cutoff], ["productionTime", candidate.productionTime]]) {
    assertFieldDate(value, candidate.date, `民生日报 ${field}`);
  }
  assertRecentDataDate(candidate.metricsCutoff, candidate.date, 7, "民生日报 metricsCutoff");
  const edition = parseIsoDate(candidate.date);
  const recentCount = allMinshengStories(candidate).filter((story) => {
    const published = parseIsoDate(String(story.publishedAt || "").slice(0, 10));
    if (!published) return false;
    const age = Math.floor((edition - published) / 86400000);
    return age >= 0 && age <= 2;
  }).length;
  if (recentCount < 12) throw new Error(`民生日报至少需要 12 条来自当天或前两天，当前只有 ${recentCount} 条`);
  assertMinshengArchiveConsistency(candidate, priorBriefs);
}

export function assertManifestEdition(edition, brief, channel) {
  if (edition.date !== brief.date) throw new Error(`${channel}索引日期 ${edition.date} 与正文日期 ${brief.date} 不一致`);
  if (edition.issue !== brief.issue) throw new Error(`${channel} ${edition.date} 索引期号 ${edition.issue} 与正文期号 ${brief.issue} 不一致`);
  if (edition.publishAt !== `${edition.date}T11:00:00+08:00`) throw new Error(`${channel} ${edition.date} 发布时间必须对应当日 11:00`);
  const expectedFile = channel === "游戏日报" ? `data/${edition.date}.json` : `data/minsheng/${edition.date}.json`;
  if (edition.file !== expectedFile) throw new Error(`${channel} ${edition.date} 文件路径必须为 ${expectedFile}`);
}

function assertNextEdition(candidate, manifest, channel) {
  const existing = manifest.editions.find((edition) => edition.date === candidate.date);
  if (existing) throw new Error(`${channel} ${candidate.date} 已成功归档，拒绝覆盖或重复发布`);
  const latest = [...manifest.editions].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latest && candidate.date <= latest.date) throw new Error(`${channel}候选日期 ${candidate.date} 必须晚于最新归档 ${latest.date}`);
  const expectedIssue = Math.max(0, ...manifest.editions.map((edition) => edition.issue)) + 1;
  if (candidate.issue !== expectedIssue) throw new Error(`${channel} ${candidate.date} 期号必须为 ${expectedIssue}`);
}

function recentPriorBriefs(candidate, priorBriefs) {
  return priorBriefs
    .filter((brief) => brief?.date && brief.date !== candidate.date && brief.date < candidate.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
}

function allMinshengStories(brief) {
  return Object.values(brief.sections || {}).flat();
}

function repeatedItems(candidateItems = [], priorItems = []) {
  const priorTitles = new Set(priorItems.map(titleKey).filter(Boolean));
  const priorUrls = new Set(priorItems.map(urlKey).filter(Boolean));
  return candidateItems.filter((item) => {
    const title = titleKey(item);
    const url = urlKey(item);
    return Boolean((title && priorTitles.has(title)) || (url && priorUrls.has(url)));
  }).map(displayName);
}

function titleKey(item) {
  const value = typeof item === "string" ? item : item?.title || item?.name || "";
  return String(value).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function urlKey(item) {
  if (typeof item === "string" || !item?.url) return "";
  try {
    const url = new URL(item.url);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

function displayName(item) {
  return typeof item === "string" ? item : item?.title || item?.name || item?.url || "未命名条目";
}

function assertFieldDate(value, date, label) {
  if (!String(value || "").startsWith(date)) throw new Error(`${label} 必须对应 ${date}`);
}

function assertRecentDataDate(value, editionDate, maxAge, label) {
  const valueDate = parseIsoDate(String(value || "").slice(0, 10));
  const edition = parseIsoDate(editionDate);
  const age = Math.floor((edition - valueDate) / 86400000);
  if (age < 0 || age > maxAge) throw new Error(`${label} 必须是 ${editionDate} 当天或此前 ${maxAge} 天内的有效数据日`);
}

function previousIsoDate(value) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`无效日期：${value}`);
  return date;
}
