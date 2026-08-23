import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("缺少 OPENAI_API_KEY，无法生成日报");

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
}).formatToParts(new Date());
const value = Object.fromEntries(parts.map(x => [x.type, x.value]));
const date = `${value.year}-${value.month}-${value.day}`;

const string = { type: "string" };
const item = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const schema = {
  type: "object", additionalProperties: false,
  required: ["date","issue","cutoff","dataWindow","sources","features","news","packs","mods","deals","trends"],
  properties: {
    date: string, issue: { type: "integer" }, cutoff: string, dataWindow: string,
    sources: { type: "array", minItems: 3, items: string },
    features: { type: "array", minItems: 2, maxItems: 2, items: item({ title:string, summary:string, source:string, date:string, image:string, url:string }) },
    news: { type: "array", minItems: 10, maxItems: 10, items: item({ title:string, summary:string, source:string, date:string, image:string, url:string }) },
    packs: { type: "array", minItems: 10, maxItems: 10, items: item({ name:string, summary:string, category:string, heat:{type:"integer",minimum:1,maximum:100}, source:string, image:string, url:string }) },
    mods: { type: "array", minItems: 6, maxItems: 6, items: item({ name:string, summary:string, version:string, loader:string, date:string, source:string, url:string }) },
    deals: { type: "array", minItems: 4, maxItems: 4, items: item({ name:string, discount:string, original:string, price:string, label:{type:"string",enum:["新史低","平史低","今日特惠"]}, ends:string, image:string, url:string }) },
    trends: { type: "array", minItems: 4, maxItems: 4, items: string }
  }
};

const instructions = `你是严谨的中国游戏日报编辑。当前日期为 ${date}，时区为 Asia/Shanghai。联网核验每一项，禁止杜撰。
每日游戏新闻固定 10 条，只采集当天或前一天的中国游戏媒体、国内玩家论坛、国内视频网站或中国大陆官方渠道。
Minecraft 整合包固定 10 个，依据当天或前一天中国 Minecraft 社区热度；热度是综合指数而非网站官方排名。
Java Mod 固定 6 个，先选近 7 天中国 Minecraft Mod 网站的新发布或更新，不足时用近 30 天补足并保留真实日期；必须核验版本和加载器。
Steam 国区优惠固定 4 个，优惠须持续到当天 23:59 后；只有核验历史价格才能标新史低或平史低，否则标今日特惠。
features 第一条选最重要中国游戏新闻，第二条选最重要 Minecraft 社区动态。
image 必须是与条目对应、可公开访问的文章封面或官方宣传图的 https 绝对地址；没有可靠图片时返回空字符串，不要编造 URL。
url 必须是逐条核验过的 https 原文地址：新闻链接到对应报道或官方公告，整合包和 Mod 链接到具体项目详情页，Steam 优惠链接到对应国区商店页；禁止使用搜索结果页、网站首页或编造地址。
简介简洁，所有日期用 YYYY-MM-DD，价格用人民币。cutoff 和 dataWindow 明确写北京时间。issue 用 YYYYMMDD 数字。`;

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    instructions,
    input: `生成 ${date} 的“游戏方块日报”。先使用 web_search 检索和交叉核验，再严格按 JSON schema 输出。`,
    tools: [{ type: "web_search" }],
    tool_choice: "auto",
    max_tool_calls: 24,
    max_output_tokens: 16000,
    text: { format: { type: "json_schema", name: "daily_game_brief", strict: true, schema } }
  })
});

if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${await response.text()}`);
const result = await response.json();
const outputText = result.output_text || result.output?.flatMap(x => x.content || []).find(x => x.type === "output_text")?.text;
if (!outputText) throw new Error(`生成结果中没有正文，状态：${result.status}`);
const brief = JSON.parse(outputText);
brief.date = date;
validate(brief);

const pendingDir = path.join(process.cwd(), "data", ".pending");
await mkdir(pendingDir, { recursive: true });
await writeFile(path.join(pendingDir, `${date}.json`), `${JSON.stringify(brief, null, 2)}\n`, "utf8");
console.log(`已生成 ${date} 日报草稿，等待 11:00 发布。`);

function validate(b) {
  const exact = [["features",2],["news",10],["packs",10],["mods",6],["deals",4],["trends",4]];
  for (const [key,count] of exact) if (!Array.isArray(b[key]) || b[key].length !== count) throw new Error(`${key} 必须为 ${count} 项`);
  if (b.deals.some(x => !["新史低","平史低","今日特惠"].includes(x.label))) throw new Error("Steam 优惠标签不合规");
}
