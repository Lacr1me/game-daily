import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { beijingDate, normalizeMinsheng, safePendingPath, validateMinsheng } from "./minsheng-lib.mjs";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("缺少 OPENAI_API_KEY，无法生成民生日报");
const root = process.cwd();
const date = beijingDate();
const earliestDate = new Date(`${date}T00:00:00+08:00`);
earliestDate.setUTCDate(earliestDate.getUTCDate() - 7);
const earliest = earliestDate.toISOString().slice(0, 10);
const manifest = JSON.parse(await readFile(path.join(root, "data", "minsheng", "index.json"), "utf8"));
const existing = manifest.editions.find((edition) => edition.date === date);
const issue = existing?.issue || Math.max(0, ...manifest.editions.map((edition) => edition.issue || 0)) + 1;

const string = { type: "string" };
const object = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const story = object({ title: string, summary: string, source: string, publishedAt: string, url: string });
const metric = object({
  kind: { type: "string", enum: ["gold", "domestic_oil", "international_oil", "international_oil_wti", "usd_cny", "eur_cny", "jpy_cny", "shanghai_index", "china_indexes", "other"] },
  icon: string, name: string, value: string, note: string
});
const schema = object({
  date: string,
  weekday: string,
  lunarDate: string,
  cutoff: string,
  productionTime: string,
  sections: object({
    domestic: { type: "array", minItems: 10, maxItems: 10, items: story },
    international: { type: "array", minItems: 10, maxItems: 10, items: story },
    tech: { type: "array", minItems: 10, maxItems: 10, items: story },
    ai: { type: "array", minItems: 5, maxItems: 5, items: story }
  }),
  topStories: { type: "array", minItems: 3, maxItems: 3, items: object({ category: { type: "string", enum: ["domestic", "international", "tech", "ai"] }, position: { type: "integer", minimum: 1, maximum: 10 } }) },
  metrics: { type: "array", minItems: 6, maxItems: 10, items: metric },
  metricsCutoff: string,
  metricSources: { type: "array", minItems: 2, items: string },
  observation: string,
  sources: { type: "array", minItems: 3, items: string }
});

const instructions = `你是严谨的中文“民生日报”总编辑。当前日期是 ${date}，所有时间按 Asia/Shanghai。必须先联网打开原始报道或权威机构页面核验每一条，禁止杜撰标题、数字、时间、论文、来源或URL。

固定生成35条且不得重复：
1. domestic 中国时政与民生10条：优先 ${date} 或前一天，不足才用 ${earliest} 至 ${date}；聚焦就业、收入、社保、医保、养老、教育、住房、物价、消费、交通、公共安全、公共服务和生态环境；优先中国政府网、新华社、人民日报、央视及国务院部门和省级政府官网。
2. international 全球国际10条：优先 ${date} 或前一天，不足使用 ${earliest} 至 ${date}；国家与议题均衡；冲突、伤亡、制裁、选举至少核对原始机构或两家独立权威媒体。
3. tech 中国科技10条：发布时间必须在 ${earliest} 至 ${date}，限中国机构、高校或企业主导的实质性科研与工程进展；论文优先引用期刊、论文或科研机构页面，禁止把营销和融资写成科研突破。
4. ai AI科技5条：发布时间必须在 ${earliest} 至 ${date}，关注模型、算法、芯片、机器人、AI安全、论文或开发平台重要更新；明确正式发布、预览、开源或预印本状态。
所有35条的 publishedAt 日期部分必须落在 ${earliest} 至 ${date}（含首尾）之间；找不到足量条目时继续检索该窗口内的其他权威来源，绝不能使用更早日期。

每条 summary 必须40—90个中文字符；publishedAt 使用 YYYY-MM-DD 或真实可核验的 YYYY-MM-DD HH:mm，不能确认时分就只写日期；url 必须是逐条核验的 HTTPS 原文或权威机构页面，不能是搜索结果页。按时效性、公共影响和重要性排序。

topStories 从35条正文中选3条，category 与 position 引用正文位置，不新增事实且不得重复。

metrics 必须包含 kind=gold、domestic_oil、international_oil、usd_cny、eur_cny、jpy_cny；可增加WTI和股指。休市时使用最近交易日并在 note 中明确。单位必须完整，汇率写清1美元、1欧元或100日元兑人民币。优先上海黄金交易所、国家或地方发改委、中国外汇交易中心/央行、交易所或权威金融源。

observation 必须120—220字，只综合正文已支持的趋势。weekday 写星期与节气（如适用），lunarDate 写农历。cutoff、productionTime、metricsCutoff 均写“YYYY-MM-DD HH:mm（北京时间）”。不要生成任何天气、城市定位、温度、风力字段，也不要调用天气或定位服务。`;

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions,
    input: `生成 ${date} 的民生日报。逐条联网检索并核验，完成后严格按 JSON Schema 输出。`,
    tools: [{ type: "web_search" }],
    tool_choice: "auto",
    include: ["web_search_call.action.sources"],
    max_tool_calls: 24,
    max_output_tokens: 18000,
    text: { format: { type: "json_schema", name: "minsheng_daily_brief", strict: true, schema } }
  })
});

if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
const result = await response.json();
if (result.status !== "completed") throw new Error(`生成未完成：${result.status}${result.incomplete_details ? ` (${JSON.stringify(result.incomplete_details)})` : ""}`);
const outputText = result.output_text || result.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
if (!outputText) throw new Error("生成结果中没有结构化正文");
const brief = normalizeMinsheng(JSON.parse(outputText));
brief.date = date;
brief.issue = issue;
validateMinsheng(brief, { expectedDate: date });

const { pendingDir, pending } = safePendingPath(root, date);
await mkdir(pendingDir, { recursive: true });
await writeFile(pending, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
console.log(`已生成并校验 ${date} 民生日报草稿，等待 11:00 发布。`);
