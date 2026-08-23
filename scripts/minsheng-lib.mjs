import path from "node:path";

export const CATEGORY_COUNTS = { domestic: 10, international: 10, tech: 10, ai: 5 };
export const REQUIRED_METRIC_KINDS = ["gold", "domestic_oil", "international_oil", "usd_cny", "eur_cny", "jpy_cny"];

export function beijingDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function assertPublishTime(date, now = new Date()) {
  const publishAt = new Date(`${date}T11:00:00+08:00`).getTime();
  if (!Number.isFinite(publishAt) || now.getTime() < publishAt) {
    throw new Error(`${date} 民生日报不得在北京时间 11:00 前发布`);
  }
}

export function normalizeMinsheng(brief) {
  for (const [category, count] of Object.entries(CATEGORY_COUNTS)) {
    if (!Array.isArray(brief.sections?.[category])) continue;
    brief.sections[category] = brief.sections[category].slice(0, count).map((story, index) => ({
      id: `${category}-${String(index + 1).padStart(2, "0")}`,
      ...story
    }));
  }
  if (Array.isArray(brief.topStories)) {
    brief.topStoryIds = brief.topStories.map(({ category, position }) => `${category}-${String(position).padStart(2, "0")}`);
    delete brief.topStories;
  }
  return brief;
}

export function validateMinsheng(brief, { expectedDate } = {}) {
  const errors = [];
  if (!brief || typeof brief !== "object") throw new Error("日报必须是对象");
  if (expectedDate && brief.date !== expectedDate) errors.push(`日期必须为 ${expectedDate}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(brief.date || "")) errors.push("date 必须为 YYYY-MM-DD");
  if (!Number.isInteger(brief.issue) || brief.issue < 1) errors.push("issue 必须为正整数");
  for (const field of ["weekday", "lunarDate", "cutoff", "productionTime", "metricsCutoff", "observation"]) {
    if (!brief[field] || typeof brief[field] !== "string") errors.push(`${field} 不能为空`);
  }
  for (const field of ["cutoff", "productionTime", "metricsCutoff"]) {
    if (brief[field] && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}（北京时间）$/.test(brief[field])) errors.push(`${field} 必须为 YYYY-MM-DD HH:mm（北京时间）`);
  }
  for (const field of ["cutoff", "productionTime"]) {
    if (brief[field] && brief.date && !brief[field].startsWith(brief.date)) errors.push(`${field} 必须对应日报日期 ${brief.date}`);
  }
  const editionDate = parseDate(brief.date);
  const metricsDate = parseDate((brief.metricsCutoff || "").slice(0, 10));
  if (editionDate && metricsDate) {
    const metricsAge = Math.floor((editionDate - metricsDate) / 86400000);
    if (metricsAge < 0 || metricsAge > 7) errors.push("metricsCutoff 必须是日报日期当天或此前7天内的最近有效行情日");
  }
  const observationLength = [...(brief.observation || "")].length;
  if (observationLength < 120 || observationLength > 220) errors.push(`今日观察必须为120—220字，当前${observationLength}字`);

  const ids = new Set();
  const titles = new Set();
  for (const [category, expectedCount] of Object.entries(CATEGORY_COUNTS)) {
    const stories = brief.sections?.[category];
    if (!Array.isArray(stories) || stories.length !== expectedCount) {
      errors.push(`${category} 必须为 ${expectedCount} 条`);
      continue;
    }
    stories.forEach((story, index) => {
      const prefix = `${category}-${String(index + 1).padStart(2, "0")}`;
      if (story.id !== prefix) errors.push(`${category} 第${index + 1}条 ID 应为 ${prefix}`);
      if (ids.has(story.id)) errors.push(`重复 ID：${story.id}`);
      ids.add(story.id);
      if (!story.title?.trim()) errors.push(`${prefix} 缺少标题`);
      if (titles.has(story.title?.trim())) errors.push(`重复标题：${story.title}`);
      titles.add(story.title?.trim());
      const summaryLength = [...(story.summary || "")].length;
      if (summaryLength < 40 || summaryLength > 90) errors.push(`${prefix} 摘要必须为40—90字，当前${summaryLength}字`);
      if (!story.source?.trim()) errors.push(`${prefix} 缺少来源`);
      if (!/^https:\/\//.test(story.url || "")) errors.push(`${prefix} 必须使用 HTTPS 原文链接`);
      if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(story.publishedAt || "")) errors.push(`${prefix} 发布时间格式无效`);
      const publishedDate = parseDate((story.publishedAt || "").slice(0, 10));
      if (!publishedDate) errors.push(`${prefix} 发布时间无效`);
      if (editionDate && publishedDate) {
        const age = Math.floor((editionDate - publishedDate) / 86400000);
        if (age < 0 || age > 7) errors.push(`${prefix} 发布时间必须在日报日期前7天内`);
      }
    });
  }

  if (!Array.isArray(brief.topStoryIds) || brief.topStoryIds.length !== 3) errors.push("topStoryIds 必须引用3条正文");
  else {
    if (new Set(brief.topStoryIds).size !== 3) errors.push("今日3件大事不能重复");
    brief.topStoryIds.forEach((id) => { if (!ids.has(id)) errors.push(`头条引用不存在：${id}`); });
  }

  if (!Array.isArray(brief.metrics) || brief.metrics.length < 6) errors.push("数据速览至少需要6项");
  const metricKinds = new Set((brief.metrics || []).map((metric) => metric.kind));
  REQUIRED_METRIC_KINDS.forEach((kind) => { if (!metricKinds.has(kind)) errors.push(`缺少数据指标：${kind}`); });
  (brief.metrics || []).forEach((metric, index) => {
    for (const field of ["kind", "icon", "name", "value", "note"]) if (!metric[field]?.trim()) errors.push(`第${index + 1}个指标缺少 ${field}`);
    if (!/(\d{4}-\d{2}-\d{2}|\d{1,2}月\d{1,2}日)/.test(metric.note || "")) errors.push(`第${index + 1}个指标必须标注数据日期`);
    if (metric.kind === "gold" && !/元\/克/.test(metric.value || "")) errors.push("国内金价必须标注元/克");
    if (metric.kind === "domestic_oil" && !/元\/升/.test(metric.value || "")) errors.push("中国油价必须标注元/升");
    if (metric.kind.startsWith("international_oil") && !/美元\/桶/.test(metric.value || "")) errors.push("国际油价必须标注美元/桶");
    if (["usd_cny", "eur_cny", "jpy_cny"].includes(metric.kind) && !/人民币/.test(metric.value || "")) errors.push(`${metric.kind} 必须写明兑人民币`);
  });
  if (!Array.isArray(brief.sources) || brief.sources.length < 3) errors.push("sources 至少需要3项");
  if (!Array.isArray(brief.metricSources) || brief.metricSources.length < 2) errors.push("metricSources 至少需要2项");
  if (errors.length) throw new Error(`民生日报校验失败：\n- ${errors.join("\n- ")}`);
  return brief;
}

export function safePendingPath(root, date) {
  const pendingDir = path.resolve(root, "data", ".pending", "minsheng");
  const pending = path.resolve(pendingDir, `${date}.json`);
  if (path.dirname(pending) !== pendingDir) throw new Error("拒绝使用非预期草稿路径");
  return { pendingDir, pending };
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
