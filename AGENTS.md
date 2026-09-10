# Springhues 每日简报项目代理指南

本文件作用于仓库根目录及全部子目录，保留任务路由、核心约束和验收入口。每日接力的详细流程只维护在 [运行手册](docs/daily-runbook.md)；若子目录有更具体的 `AGENTS.md`，同时遵守。

## 项目与任务路由

这是部署于 `https://springhues.com` 的纯静态双频道日报网站。生产站使用 HTML、CSS、原生 JavaScript、JSON 和图片，不使用前端框架或包管理器；Node.js 脚本负责校验、归档、构建、健康检查和发布。

- 日报制作：先按手册“状态优先入口”了解结构化状态，再读取本频道、当前阶段所需的模板和资料。游戏轮只制作 game，民生轮只制作 minsheng。
- 发布与补跑：先区分已归档、已就绪、研究缺口和部署故障，再按频道推进；不默认重读两个模板或重做两个频道。
- 只读审计、规则文档修改：读取相关文档、脚本接口和配置即可，不初始化当天运行、不获取生产租约、不检索新闻、不生成或发布日报。
- 代码或视觉任务：按实际影响范围读取源码与相关模板，使用手册的“验证映射”。视觉任务另遵守用户的全局 UI 学习要求。
- 自动化提示词只保留频道、入口、阶段目标和必要限制；详细流程不得复制到提示词或模板技能中。

## 事实来源与职责

用户当前要求及适用 AGENTS 约束优先。在此范围内，各来源各负其责：

| 来源 | 唯一职责 |
| --- | --- |
| [docs/daily-runbook.md](docs/daily-runbook.md) | 状态读取、阶段推进、租约、时间优先级、失败恢复、完成语义和验证映射 |
| 已安装的 `artifact-template-daily-brief`、`artifact-template-minecraft-daily-brief` | 各频道内容、来源优先级、时效、证据及统一渲染契约；按阶段读取引用文件 |
| `config/daily-sources.json` | 来源 ID、标准名称、别名、必查集合和终态规则 |
| 实际网页源码 | 唯一视觉与交互标准 |
| 当天候选 JSON | 当次 HTML/PNG 和待发布正文的唯一文字来源 |
| 实际脚本、结构化状态与文件证据 | 支持的接口和真实进度；文档不得凭空增加状态或把标签当作完成证明 |

模板的内容规则不替代运行流程；手册不放宽内容标准。`README.md`、历史日志、交接材料和旧模板包只用于追溯，不覆盖当前手册、注册表或源码。

## 目录入口

| 路径 | 作用与约束 |
| --- | --- |
| `index.html`、`portal.css`、`portal.js` | 双频道门户，只展示已到 publishAt 的最新归档 |
| `game/index.html`、根级 `app.js`、`styles.css` | 游戏日报 |
| `minsheng/` | 民生日报；保留 aligned-layout.css 引用及 mobile-fix.css 导出关键规则 |
| `brand.css`、`brand-assets/` | 共用品牌；图片控制宽高，保留 Logo 比例与透明度 |
| `data/index.json`、`data/minsheng/index.json` | 游戏、民生正式索引，只由发布脚本更新 |
| `data/YYYY-MM-DD.json`、`data/minsheng/YYYY-MM-DD.json` | 正式正文，不以新候选覆盖已发布期次 |
| `data/.pending/` | 游戏候选；民生位于其 minsheng 子目录；Git 忽略 |
| `downloads/game/`、`downloads/minsheng/` | 正式公开 3840px PNG，发布时提交 Git |
| `game-brief-assets/` | 每期游戏图片，新图必须使用当天日期文件名前缀 |
| `artifacts/operations/` | 当天状态、账本、审计、冻结清单、readiness、渲染和健康证据；不得清理未完成运行 |
| `scripts/` | 运行状态、内容/归档校验、渲染前后验证、发布、构建、健康与维护入口；详细命令见手册 |
| `data/embedded.js`、`dist/` | 分别由 build-embedded.mjs、build-site.mjs 生成，禁止手改 |
| `messages/`、`admin/messages/`、`privacy/`、`supabase/` | 公开留言、无公开入口的后台、隐私说明和服务端 |
| `offline-homepage-editor/` | 独立离线编辑器，仅浏览器本地保存，不自动修改正式首页 |
| `.github/workflows/` | Pages 和日志工作流；推送 main 可触发生产部署 |
| `.codex/`、`.tools/`、历史 HTML/PNG、`daily-brief-template-package/` | 本机配置、缓存或历史材料，不是每日生产入口 |

## 核心内容与产物约束

- 民生固定 10 条国内、10 条国际、10 条中国科技、5 条 AI；今日 3 件大事引用这 35 条中的 3 条。数据至少覆盖黄金、国内油价、国际油价和美元/欧元/日元兑人民币；保留今日观察，天气留白。
- 新民生期次使用 `sourcePolicyVersion: 2`。按栏目穷尽国内权威来源后才可用外网权威来源补精确差额；正文来源归属和同日审计数量必须一致，外网标识由网页生成。
- 游戏固定 2 焦点、10 新闻、10 整合包、6 Mod、4 趋势。新闻为当天或前一天；整合包保留当天或前一天的 `heatEvidenceAt`、可追溯 `heatSignals`。Mod 仅在模板允许时使用 30 天回退，版本、加载器、真实日期逐项核验。
- Steam 最迟 08:00 冻结当天确定性发现面，后续只复核冻结 appId；候选、网页和可编辑 HTML 包含全部核验合格项（至少 6 项、无上限），静态 PNG 只显示排序前 6 项。价格、国区币种、截止时间与史低标签必须有证据，`ends` 使用“截至 MM-DD”格式。
- 保留全部来源优先级、时效窗口、必查终态、逐项证据与最近七期去重门禁；不得复制上一期、改旧日期、用旧 URL 或图片冒充新内容。
- 使用本频道统一 `render.mjs --scale 2 --validate true`，JSON/HTML/PNG 同源；公开 PNG 必须与渲染 PNG 哈希一致、准确宽 3840px，经原图视觉检查后生成 readiness。禁止用 ImageGen 绘制密集正文。
- 页面保留原始可点击链接，外链使用 `noopener noreferrer`；下载按钮指向当前期次 PNG。两频道保留 `?date=YYYY-MM-DD`，无效或未到发布时刻的日期回退至最新已发布期。
- 民生桌面逐行对齐与移动端 `height: auto !important` 高度重置必须同时有效；导出关键样式不得只写入 aligned-layout.css，须保留 mobile-fix.css 对应规则。

## 运行与权限边界

- 固定 `Asia/Shanghai`、当天 11:00 的 `publishAt`；11:00 前禁止发布。当前三个任务的调度以手册记录和实际配置为准，普通制作不得改调度或新增 heartbeat。
- 所有每日写入由持有同日租约的任务顺序执行；按手册续租、收尾和释放。共享状态命令可能读取/更新双频道汇总，不授权制作另一频道。
- 按真实状态连续推进；检查点是落盘进度，不是停止条件。门禁失败禁止发布该频道，允许继续诊断和授权范围内修复。
- 已就绪频道先核验已有证明，已发布频道先核验归档和健康；保护既有成果，禁止重复发布。单频道缺口不阻塞另一频道满足门禁后的发布。
- `run.status=complete` 只表示本轮执行正常结束；频道 `ready`、本地 `published` 和当天线上发送成功分别验收。未有线上 `healthy=true` 不得报告双频道发送成功。
- 禁止 OpenAI Platform API、`OPENAI_API_KEY`、`api.openai.com` 和任何付费模型 API。每日研究只使用当前 Codex 任务提供的网页检索。
- 日报发布授权不等于外部日志、留言或其他载荷的外发授权；调用外发命令仍须有该载荷的明确授权并遵守环境审批。不得输出或提交密钥、密码、.env、service-role key 等秘密。
- 计划任务依赖开机、网络和 Codex 桌面应用运行；无法弥补关机、休眠或应用退出。

## 留言与后台安全

公开留言只展示 approved 记录；后台不得添加公开导航。保留邮箱密码登录、RLS、鉴权、限流和最多 500 字的纯文本回复。留言、回复、日志均以纯文本安全渲染，不信任服务端 HTML。配置未完成时安全禁用表单，不发往未知地址。`message-config.js` 仅容纳公开函数 URL、Turnstile site key 和 Supabase publishable key；留言或追踪行为变化须同步隐私说明。

## 验证与完成入口

验证清单只维护在 [手册“验证映射”](docs/daily-runbook.md#验证映射)。按只读审计、文档修改、单频道内容/视觉、共享修改、正式发布选择；不要因修改流程文字而运行日报生产，也不要因只改一个频道而强制重渲染另一频道。

交付必须区分已修改、已验证和未验证。正式双频道发布还必须满足手册“发送成功判定”；桌面镜像和外部日志问题单独报告，不冒充网站失败或回滚已健康期次。

## 编辑与 Git 纪律

- 先查 `git status --short`；只修改、暂存和提交授权范围内文件，保留无关未提交文件，尤其 .codex、历史文档、离线编辑器和维护脚本。
- 使用 `apply_patch` 编辑文本；生成与复制正式产物使用对应脚本或安全复制命令。
- 禁止手改 dist、embedded.js、归档索引绕过流程；禁止 `git reset --hard`、`git checkout --` 等丢弃改动的操作。
- 提交前运行 `git diff --check` 和适用验证；正常日报发布目标为 origin/main，但文档、审计或本地修改不自动授权推送。已提交不等于已部署。
