# 双频道日报运行手册

本手册是两个独立 Codex 计划任务的仓库入口。事实、来源与视觉规则仍以 `$artifact-template-daily-brief`、`$artifact-template-minecraft-daily-brief` 及其 `artifact-template.json`、`references/editorial-rules.md`、`references/layout-spec.md` 为准；网页源码是唯一视觉标准，候选 JSON 是唯一文字标准。

## 不可变约束

- 时区固定为 `Asia/Shanghai`。主任务 09:30 开始，`publishAt` 固定为当天 11:00；11:00 前禁止调用发布脚本。
- 每次计划运行是新任务，不读取或延续旧聊天。当天续跑只读取仓库、`data/.pending/` 和 `artifacts/operations/` 中的结构化状态。
- 禁止 OpenAI Platform API、`OPENAI_API_KEY`、`api.openai.com` 和任何付费模型 API。只使用当前 Codex 任务自带网页检索。
- 不复制上一期，不复用旧 URL 冒充新内容；保留用户未提交和无关改动。
- 不得仅因某个站点一次不可用就结束。来源不可用只有在实际重试两次后才是账本终态，其他来源仍须继续。

## 每次运行的启动步骤

1. 计算北京时间日期，完整读取两个模板技能及各自三个必读文件，并读取 `config/daily-sources.json`、本手册、两个归档索引和最近七期。
2. 主任务创建一个只属于本次任务的长时目标：成功条件是两个频道分别完成发布与线上验证，或逐项穷尽来源并留下可审计的失败证据。禁止用 heartbeat 替代该目标。
3. 以两个索引的“最新期号 + 1”初始化状态：

   `node scripts/daily-run-state.mjs init --date=YYYY-MM-DD --run-id=0930 --kind=main --minsheng-issue=N --game-issue=N`

   11:10 补跑使用 `--run-id=1110 --kind=recovery`，不得新建另一套当天状态。

4. 先运行 `node scripts/daily-run-state.mjs status --date=YYYY-MM-DD`。11:10 只处理 `missing`、`incomplete` 或尚未发布的频道和栏目。

## 检索账本与审计

每完成一个来源站点或来源类别，立即记录，不得等任务末尾回忆补写：

`node scripts/daily-run-state.mjs record --date=YYYY-MM-DD --run-id=0930 --channel=minsheng --section=domestic --source=新华网 --tier=primary --status=accepted --url=https://... --available=3 --rejected=1 --reason=重复1条 --candidates=id-1|id-2`

允许状态为：

- `started`：已开始但尚未完成，不能通过门禁。
- `accepted`：完成该来源核验并取得可用候选。
- `rejected`：完成核验但候选全部因时效、重复、权威性或字段缺失被淘汰。
- `exhausted`：完成核验但没有符合窗口的新候选。
- `unavailable`：实际访问失败；同一频道、栏目和来源至少记录两次真实失败才算终态。

标准来源 ID、别名和各栏目必查集合只取自 `config/daily-sources.json`。不得自行用“新华社／新华网”一类组合名称替代标准名称；脚本会兼容旧别名并写回“新华网”“中国科技网”等标准名称。

民生每次运行写独立审计快照：

- `artifacts/operations/YYYY-MM-DD-0930-source-audit.json`
- `artifacts/operations/YYYY-MM-DD-1110-source-audit.json`

然后运行 `node scripts/merge-source-audits.mjs --date=YYYY-MM-DD` 生成发布脚本使用的 `YYYY-MM-DD-source-audit.json`。后一次任务不得直接覆盖前一次快照。

在判断“证据不足”或调用任一发布脚本前，必须运行：

`node scripts/check-research-completeness.mjs --date=YYYY-MM-DD`

命令失败表示仍是“尚未搜完”，不得报告“素材不足”。发布脚本也会再次执行同一门禁。

## 制作、渲染与发布

- 09:30—10:25：逐项检索并持续写账本；先填国内来源，只有对应栏目国内池完整穷尽后才用外网补精确差额。
- 10:25—10:40：从候选池生成 `data/.pending/minsheng/YYYY-MM-DD.json` 和 `data/.pending/YYYY-MM-DD.json`。民生为 10/10/10/5；游戏为 2 features、10 news、10 packs、6 mods、6—24 deals、4 trends。
- 新游戏期次每个 pack 必须包含当天或前一天的 `heatEvidenceAt` 和可追溯的 `heatSignals`；整合包自身不要求当天发布。Mod 只有模板允许时可回退30天。
- 10:40—10:50：分别调用两个技能的统一 `render.mjs`，使用 `--scale 2 --validate true`，HTML与PNG必须来自同一候选JSON。工作版写入 `artifacts/operations/YYYY-MM-DD-render/`，公开PNG与桌面成品按模板路径复制。
- 10:50后冻结栏目，只修复校验错误。依次执行来源完整性、两个频道校验器、归档一致性、嵌入构建、站点测试、站点构建和构建验证。
- 11:00后两个频道独立调用 `publish-minsheng.mjs` 与 `publish-brief.mjs`。成功一个就保留一个，失败频道继续展示上一期。
- 发布后重建、测试、提交并推送 `main`，等待 Pages，再运行 `node scripts/check-daily-health.mjs --live=https://springhues.com`。

## 11:10 决策顺序

1. 读取健康检查的 `healthy`、`degraded`、`warnings`、`reasonCodes`、`transport` 和每频道 `content/png/deployment`。
2. 今日双频道全部健康：只记录结果，不重做、不发布、不触发Pages。
3. 本地正式内容与PNG健康、仅线上部署失败：只处理部署，不重新生成内容。
4. 正式内容缺失但pending合法：继续渲染、复制PNG、校验和发布。
5. 账本显示研究未完成：只补 `missingSections`；沿用当天账本，不覆盖09:30审计快照。
6. TLS证书异常且同域HTTP只读复核完整：视为 `healthy=true, degraded=true`，只报告TLS待修复。
7. 只有来源完整性门禁通过后仍缺素材、频道内容无效、PNG无效、归档门禁失败或Pages明确失败，才按失败处理并通知人工。

每次完成阶段后用 `daily-run-state.mjs checkpoint` 更新 `stage`、频道状态和缺失栏目。所有同日操作必须幂等，已发布频道不得覆盖。
