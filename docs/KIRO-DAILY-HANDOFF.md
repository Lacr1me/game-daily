# Springhues 日报计划交接参考 给 Kiro

配置核对日期：2026-10-18，时区 `Asia/Shanghai`。

这份文档用于帮助 Kiro 理解原有游戏日报、民生日报和发布补跑计划，仅供参考。2026-10-18 用户确认“已全权交给 kiro”，并要求停掉现有计划；本机三个 Codex 计划现已全部设为 `PAUSED` 并读回确认，其余配置保留。后续日报由 Kiro 接管，本文不构成重新启用 Codex 计划的指令；Kiro 的实际生产验收由接管方核对。

## 1 项目与现有计划

- 工作目录：`F:\Codex-App\日报设计`。
- 源码远端：[Lacr1me/game-daily](https://github.com/Lacr1me/game-daily)。`main` 用于前端开发，`publish` 用于每日发布并触发 Pages。
- 生产站：[springhues.com](https://springhues.com/)，频道入口为 `/game/` 和 `/minsheng/`。
- 技术栈：静态 HTML、CSS、原生 JavaScript、JSON 和图片；Node.js 执行校验、渲染辅助、归档、构建和发布。不引入前端框架或包管理器。
- 每期 `publishAt` 固定为北京时间当天 11:00，11:00 前禁止发布。05:00 起分轮制作，11:01 首次发布，11:31 复查补跑。

以下为直接读取本机三个 `automation.toml` 得到的配置快照，任务名称、ID 和调度均保留原值。三项均已暂停，表内时间仅供 Kiro 参考。

| 任务 | ID | 北京时间每日启动点 | 原始 RRULE | 目标 |
| --- | --- | --- | --- | --- |
| 每日游戏日报制作接力（05:00-10:00） | `05-00-10-00` | 05:00、06:00、07:00、08:00、09:00、10:00 | `RRULE:FREQ=DAILY;BYHOUR=5,6,7,8,9,10;BYMINUTE=0` | 仅 game，推进至有效 ready，制作轮不发布 |
| 每日民生日报制作接力（05:30-10:30） | `automation` | 05:30、06:30、07:30、08:30、09:30、10:30 | `RRULE:FREQ=DAILY;BYHOUR=5,6,7,8,9,10;BYMINUTE=30` | 仅 minsheng，推进至有效 ready，制作轮不发布 |
| 每日双频道发布与补跑（11:01/11:31） | `11-10` | 11:01、11:31 | `RRULE:FREQ=DAILY;BYHOUR=11;BYMINUTE=1,31` | 优先发布已满足门禁的频道，再补明确缺口与部署问题 |

三个计划共有配置：

| 字段 | 当前值 |
| --- | --- |
| `kind` / `status` | `cron` / `PAUSED`，已停用 |
| `model` / `reasoning_effort` | `gpt-6.1-sol` / `low` |
| `notification_policy` | `failed_runs_only`，仅失败通知 |
| `execution_environment` | `local` |
| `target` | 项目 `9ebd3501-508a-4df5-8af6-02de7a0f7724` |
| `cwds` | `F:\Codex-App\日报设计` |

原始配置位置分别为：

- `C:\Users\Lacr1me\.codex\automations\05-00-10-00\automation.toml`
- `C:\Users\Lacr1me\.codex\automations\automation\automation.toml`
- `C:\Users\Lacr1me\.codex\automations\11-10\automation.toml`

RRULE 本身未携带时区字段；上述北京时间解释来自项目运行手册。模型名和项目 ID 属于当前 Codex 配置，不代表 Kiro 能直接识别。现有本地调度依赖电脑开机、联网和 Codex 桌面应用运行，不能补偿关机、休眠或退出造成的漏跑。

## 2 接手时先读哪些资料

本文件只提供导航和摘要，详细流程继续只维护在运行手册。若摘要与后续更新冲突，以用户当前要求、适用 AGENTS、实际脚本和结构化证据为准。

| 资料 | 作用 |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | 任务路由、频道隔离、硬约束、Git 纪律和验收入口 |
| [双频道日报运行手册](daily-runbook.md) | 唯一详细运行流程；先读“状态优先入口”“状态字段与完成语义”，再按本轮阶段读取 |
| [来源注册表](../config/daily-sources.json) | 标准来源 ID、名称、别名、必查集合和终态规则 |
| [执行预算配置](../config/daily-execution-policy.json) | 当前 `configuredBudgetMinutes=null`，没有默认 25 分钟执行预算 |
| [网站交接手册](HANDOFF.md) | 仓库与 Pages 背景、提交与回滚说明；日报生产仍按运行手册，不顺带接管软件发布或网站改版 |
| 本频道模板及引用 | 内容、时效、证据、布局与统一渲染契约；只读当前频道和阶段需要的部分 |

本机模板入口：

- 民生：`C:\Users\Lacr1me\.codex\skills\artifact-template-daily-brief\SKILL.md`
- 游戏：`C:\Users\Lacr1me\.codex\skills\artifact-template-minecraft-daily-brief\SKILL.md`

研究或修候选前完整阅读本频道 `references/editorial-rules.md`；渲染或视觉修复前阅读 `references/layout-spec.md`。两个模板目录都包含 `scripts/render.mjs`。Kiro 可从这些路径读取规范和复用脚本，但不能假定 `$artifact-template-...` 是 Kiro 的内置命令。换机器时需要迁移相应依赖，仓库里的旧模板包不是当前生产入口。

## 3 接力依据与只读入口

每次计划运行从新任务开始，通过仓库落盘状态接力，不依赖旧聊天。先查 Git、状态、readiness、索引与已有健康证明，按真实缺口继续；已有 ready 或 published 标签须核对关联证据。

| 文件 | 用途 |
| --- | --- |
| `artifacts/operations/YYYY-MM-DD-run-state.json` | 当日运行、频道和阶段状态 |
| `artifacts/operations/YYYY-MM-DD-run-lease.json` | 当日共享写入租约 |
| `artifacts/operations/YYYY-MM-DD-research-ledger.jsonl` | 追加式研究账本和逐项证据 |
| `artifacts/operations/YYYY-MM-DD-steam-discovery-frozen.json` | 当日 Steam 冻结发现面 |
| `artifacts/operations/YYYY-MM-DD-HHMM-source-audit.json` | 民生每轮独立来源审计快照 |
| `artifacts/operations/YYYY-MM-DD-source-audit.json` | 合并后的民生审计 |
| `artifacts/operations/YYYY-MM-DD-readiness.json` | 各频道就绪证明及关联文件身份 |
| `artifacts/operations/YYYY-MM-DD-health.json` | 双频道健康证明；单频道保存使用日期后加频道的文件名 |
| `data/.pending/YYYY-MM-DD.json` | 游戏候选 |
| `data/.pending/minsheng/YYYY-MM-DD.json` | 民生候选 |
| `artifacts/operations/YYYY-MM-DD-render/` | 统一渲染 HTML、PNG 和检查证据 |
| `data/index.json`、`data/minsheng/index.json` | 正式频道索引，由发布脚本维护 |
| `downloads/game/`、`downloads/minsheng/` | 对应期次的正式公开 PNG |

下面是正式接手前可使用的只读入口示例。日期按北京时间计算，不初始化运行、不获取租约、不保存健康结果：

```powershell
Set-Location -LiteralPath 'F:\Codex-App\日报设计'
$briefDate = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'China Standard Time').ToString('yyyy-MM-dd')
git status --short
node scripts/daily-run-state.mjs status "--date=$briefDate" --channel=game
node scripts/daily-run-state.mjs status "--date=$briefDate" --channel=minsheng
node scripts/check-daily-backlog.mjs
```

实际写入必须先按手册取得同日共享租约；`acquired=false` 时保持只读并结束，不初始化、不 checkpoint、不释放别人的租约。同日账本、候选、审计、渲染和发布由持租约任务顺序写入。制作 TTL 为 3000 秒，发布补跑 TTL 为 1500 秒，均只是互斥有效期，需要续租，不能当成执行预算。

制作轮按下一次既定任务启动时间保存接力、释放租约；11:31 最后恢复轮仍有可执行步骤时继续推进并续租。详细命令、收尾和异常处理见手册[状态优先入口](daily-runbook.md#状态优先入口)与[状态字段与完成语义](daily-runbook.md#状态字段与完成语义)，不从本文另建一套流程。

## 4 三类任务的内容与完成边界

| 任务 | 必须保留的要求 | 本轮目标 |
| --- | --- | --- |
| game 制作 | 2 焦点、10 新闻、10 整合包、6 Mod、4 趋势；Steam 至少 6 项并保留全部核验合格项。焦点和新闻使用当天或前一天，整合包须有当天或前一天热度证据，Mod 仅按模板允许的 30 天回退 | 本频道完整证据、合法候选、统一渲染、原图检查、公开 PNG 和有效 ready |
| minsheng 制作 | 国内 10、国际 10、中国科技 10、AI 5；三大事引用其中 3 条；黄金、国内油价、国际油价和美元／欧元／日元兑人民币至少六类数据，保留观察，天气留白。新期 `sourcePolicyVersion: 2`，先按栏目穷尽国内权威来源，再补允许的精确差额 | 本频道完整证据、同日合并审计、合法候选、统一渲染、原图检查、公开 PNG 和有效 ready |
| 发布与补跑 | 两频道独立推进；先发布合格频道，沿用账本、审计和冻结清单补缺。已归档不重复发布，仅部署失败时复用正式内容恢复部署 | 达到手册“发送成功判定”，分别报告成功频道和剩余阻断 |

以下边界适用于接手后的每一轮：

- Steam 最迟 08:00 冻结发现面，05:00 轮优先处理。之后只复核冻结 appId；无真实截止前证据时，不得晚扫动态首屏冒充按时冻结。历史单日例外不延伸到未来日期。
- 搜索摘要、来源名称清单、候选数量和 `originalVerificationPending=true` 都不能替代原文核验与逐项证据。来源终态、回退和最近七期去重按模板、注册表和脚本执行。
- 候选 JSON 是 HTML、PNG 和发布正文的唯一文字来源；使用本频道统一 `render.mjs`，参数保留 `--scale 2 --validate true`。网页是唯一视觉来源，不另做排版或用 ImageGen 绘制密集正文。
- 最终 PNG 准确宽 3840px，并完成原图视觉检查；公开 PNG 与渲染 PNG 须一致。游戏网页和可编辑 HTML 保留全部合格优惠，静态 PNG 只显示排序前 6 项。流程规定的完整性哈希继续保留，不为本参考文档额外计算哈希。
- 检查失败阻止该频道发布，同时继续可执行的诊断和范围内修复。单频道失败不阻止另一合格频道发布，也不回滚已经健康的频道。
- `run.status=complete` 表示本轮正常收尾；频道 `ready` 表示就绪；`published` 表示本地归档；目标提交 Pages 成功与新鲜线上健康才支持上线结论。单频道 `healthy=true` 只证明本次选定频道。

具体生产和恢复按手册[候选、渲染与频道就绪](daily-runbook.md#候选渲染与频道就绪)、[发布与精确恢复](daily-runbook.md#发布与精确恢复)、[发送成功判定](daily-runbook.md#发送成功判定)及[验证映射](daily-runbook.md#验证映射)执行。

## 5 发布权限和保留窗口

原发布计划保存了用户持续授权：通过当日内容、readiness、构建和时间门禁的日报产物，可提交并非强制推送到指定仓库 `publish`（发布分支），触发现有 Pages 部署及同日 `website_change` 幂等同步。来源和范围见手册[每日发布持续授权与验收](daily-runbook.md#每日发布持续授权与验收)。这项授权没有因为日期变化而失效，但本文也不触发任何发布。

接手时必须保留授权的确切范围和当前宿主审批，逐次核对远端、目标 SHA 和文件集合。不得夹带用户无关改动、软件安装包、任意代码或云配置修改、强制推送、全局权限修改和其他外发载荷；被环境审批拒绝时按实际动作和理由报告，不绕过拒绝。不要复制或输出令牌、密钥、密码、`.env` 等秘密。

每频道正式归档只保留最近 7 期。发布事务完成且验证通过后，提交前按手册[归档保留窗口](daily-runbook.md#归档保留窗口)执行现有清理入口及其后续检查；不在事务恢复中手动改索引或提前清理。当前运行、未完成 operation 证据和无关未跟踪文件继续保留，按窗口移除的旧日期不作为漏发补做。

## 6 Kiro 接管时需要适配的部分

本次没有检查 Kiro 的版本或可用工具，下表列出接管前需要满足的条件，不宣称已有对应功能或配置语法。

| 部分 | 接管条件 |
| --- | --- |
| 规则加载 | 在 Kiro 中明确加载本仓库 AGENTS 和运行手册，不依赖它自动识别 Codex 的规则、技能或聊天历史 |
| GraphFlow | 仓库要求广泛探索、实现或排错前先调用 `graphflow_context`，多步工作先 `graphflow_plan`，修改后 `graphflow_index`；Kiro 需能访问相应 MCP，`rootDir` 使用本仓库绝对路径。工具不可用时说明缺口，不宣称已完成图谱步骤 |
| 调度 | 使用能表达原三组时间的机制，显式按 `Asia/Shanghai` 解释；确认开机、联网、应用运行等执行前提。由用户确定切换时点，避免两个宿主重复投放同一生产任务；现有租约继续作为写入门禁 |
| 模型 | 将 `gpt-6.1-sol` / `low` 作为原配置快照，实际可用模型和强度由 Kiro 环境确定，不凭空映射为某个等价型号 |
| 研究 | 原规则使用当前 Codex 任务自带网页检索；Kiro 接管前须确认符合既有权限边界的等价检索能力。禁止接入 OpenAI Platform API、`OPENAI_API_KEY`、`api.openai.com` 或任何付费模型 API |
| 备用采集 | 只有 Steam 官方页有项目明确授权的本地只读浏览器备用入口；保留原始响应、真实时间及冻结门禁，不能扩展成所有新闻来源的本地爬取许可 |
| 本地脚本 | 确认可读取当前模板与渲染器，并具备 Node.js、浏览器和现有脚本实际依赖；部分浏览器入口使用 Codex 捆绑库，不能假定换宿主后路径仍然可用 |
| 视觉与上线证据 | 需要能按原始精度查看 PNG、执行真实浏览器验收并取得目标 Pages 提交证明；不能用文件存在、HTTP 200 或构建通过代替 |
| 权限恢复 | `require_escalated` 是现宿主工具参数。Kiro 应使用其真实审批入口处理同一已授权动作，保留错误与批准结果，不能照搬不存在的参数或放宽系统权限 |
| 运行记录归档 | 原计划仅在目标核验完成、结果落盘、run 正常结束、租约释放且无人工待办时调用 Codex `set_thread_archived`。Kiro 若无等价工具，就保留记录并说明归档未完成；归档聊天不等于停用计划 |
| 通知 | 保留失败通知意图，不新增 heartbeat、轮询任务或对外消息渠道 |

如缺少研究、渲染、证据采集或审批能力，应记录具体受阻环节；不能通过降低内容门禁或伪造完成状态填补能力缺口。仅阅读、整理和只读核对不需要启动当天生产。

## 7 三个角色的简短提示词参考

提示词只保留角色、入口、阶段目标和必要限制，详细流程引用运行手册。下列文本供配置时参考，不会自动创建或运行 Kiro 任务。

### 游戏制作

> 在 `F:\Codex-App\日报设计` 中，以新任务接力制作北京时间当天的 game 日报，只处理 game。先读 AGENTS.md 和 docs/daily-runbook.md 的状态优先入口、完成语义，再按实际阶段读取游戏模板。目标是从真实缺口推进到有效 ready；复用合格证据和已有成果，冻结后只复核原 appId。租约、时间边界、门禁、保存与收尾均按手册执行。制作轮不发布，遵守研究与外发权限，保留无关改动，准确报告仍缺项。

### 民生制作

> 在 `F:\Codex-App\日报设计` 中，以新任务接力制作北京时间当天的 minsheng 日报，只处理 minsheng。先读 AGENTS.md 和 docs/daily-runbook.md 的状态优先入口、完成语义，再按实际阶段读取民生模板。目标是从真实缺口推进到有效 ready；执行国内来源优先、逐项原文核验及同日审计，复用合格证据和已有成果。租约、回退、门禁、保存与收尾均按手册执行。制作轮不发布，遵守研究与外发权限，保留无关改动，准确报告仍缺项。

### 发布与补跑

> 在 `F:\Codex-App\日报设计` 中，以新任务执行北京时间当天双频道发布与精确补跑。先读 AGENTS.md，以及 docs/daily-runbook.md 的状态入口、完成语义、发布恢复、持续授权和发送成功判定，再核对分频道证据与留存缺口。11:00 后先推进合格频道，再沿用原账本、审计与 Steam 冻结清单补真实缺口；已归档不重复发布，仅部署故障只恢复部署。提交推送严格限于手册记录的持续授权并遵守宿主审批。11:31 复查接续原状态，按真实边界收尾与释放租约，分别报告本地归档、Pages、线上健康、镜像及其他待办。

三类角色统一遵守上一节的工具适配与通知边界，不能将 Codex 专用参数和工具名当作 Kiro 已支持能力。

## 8 接管验收参考

接管方可按以下情景核对；列出检查清单不代表本文已经执行这些生产验收：

1. 新任务能从结构化状态恢复进度，已有效 ready 的频道复用产物，不重复研究或渲染。
2. 被有效租约占用时保持只读；取得租约后按 run-id 写入，续租与释放不会影响另一任务。
3. 11:00 前 ready 只等待发布；Steam 缺截止前发现证据时不伪造冻结，民生仍独立推进。
4. 一个频道失败时另一合格频道照常发布；本地 published 而远端未更新时继续部署恢复。
5. 目标 SHA 的 Pages 成功，真实浏览器检查门户、当天和历史页面、日期选择与下载，线上 JSON／PNG 一致且 PNG 宽 3840px，新鲜带 `--live` 的健康检查覆盖正确频道范围。
6. 11:31 已健康时幂等收尾，仍有可修复项时继续；镜像或外部日志失败单列，不重做健康日报。
7. 原 Codex 调度和 Kiro 接管的切换点明确，通知与运行记录可追溯，未因换宿主而扩大权限或降低门禁。

以后调整调度或流程时，更新真正的配置和运行手册，再刷新本参考快照，避免把本文件维护成第二套运行规范。
