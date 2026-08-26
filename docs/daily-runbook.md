# 双频道日报运行手册

本手册是两个独立 Codex 计划任务的仓库入口。事实、来源与视觉规则仍以 `$artifact-template-daily-brief`、`$artifact-template-minecraft-daily-brief` 及其 `artifact-template.json`、`references/editorial-rules.md`、`references/layout-spec.md` 为准；网页源码是唯一视觉标准，候选 JSON 是唯一文字标准。

计划任务提示词只负责说明本轮角色和入口。本手册是运行规则的单一事实来源；提示词不得重复整段 Steam、发布、健康检查或失败恢复规则，以免增加上下文并产生版本漂移。

## 不可变约束

- 时区固定为 `Asia/Shanghai`。游戏制作任务每天 05:00—10:00 每小时整点运行，民生制作任务每天 05:30—10:30 每小时半点运行，两频道错峰使用同一运行租约；发布与补跑任务每天 11:01、11:31 独立执行。`publishAt` 固定为当天 11:00，11:00 前禁止调用发布脚本。提前到05:00开始是为完整来源回退和逐项证据核验预留的硬缓冲，不得等到10:00后才开始主要检索。
- 每次计划运行是新任务，不读取或延续旧聊天。当天续跑只读取仓库、`data/.pending/` 和 `artifacts/operations/` 中的结构化状态。
- 禁止 OpenAI Platform API、`OPENAI_API_KEY`、`api.openai.com` 和任何付费模型 API。只使用当前 Codex 任务自带网页检索。
- 不复制上一期，不复用旧 URL 冒充新内容；保留用户未提交和无关改动。
- 不得仅因某个站点一次不可用就结束。来源不可用只有在实际重试两次后才是账本终态，其他来源仍须继续。
- 电脑必须保持开机、网络可用且 ChatGPT/Codex 桌面应用持续运行。计划任务无法弥补关机、休眠或应用退出；恢复后下一次接力运行只从仓库状态续跑。
- 每次运行只推进到下一个可验证检查点，不在任务中空等下一个钟点。游戏整点轮和民生半点轮各自只处理本频道，未完成内容由本频道下一小时续接；08:30后只按真实语义缺口推进，11:01发布失败由11:31按状态精确重试。

## 每次运行的启动步骤

1. 计算北京时间日期，完整读取两个模板技能及各自三个必读文件，并读取 `config/daily-sources.json`、本手册、两个归档索引和最近七期。
2. 以北京时间 `HHMM` 作为本次 `run-id`，先取得运行租约。制作轮使用3000秒，发布补跑轮使用1500秒：

   `node scripts/daily-run-state.mjs lease-acquire --date=YYYY-MM-DD --run-id=HHMM --ttl=3000`

   返回 `acquired=false` 表示另一轮仍在运行，本轮只记录并结束，不得并发修改候选、索引或构建产物。任务的最后一步无论成功失败都执行：

   `node scripts/daily-run-state.mjs lease-release --date=YYYY-MM-DD --run-id=HHMM`

   每完成研究、渲染、发布或部署一个大阶段，再以相同命令和 `run-id` 续租；意外中断未释放时，租约会自动过期，下一轮可继续。

3. 制作任务为本轮创建阶段目标：尽量推进研究、候选、渲染或预检到下一个检查点；不能完成时必须落盘并正常结束，不得把“本轮时间结束”写成“素材不足”。禁止用 heartbeat 替代独立计划运行。
4. 以两个索引的“最新期号 + 1”幂等初始化状态：

   `node scripts/daily-run-state.mjs init --date=YYYY-MM-DD --run-id=HHMM --kind=main --minsheng-issue=N --game-issue=N`

   11:01与11:31补跑使用 `--kind=recovery`，不得新建另一套当天状态。

5. 先运行 `node scripts/daily-run-state.mjs reconcile --date=YYYY-MM-DD`，再运行 `node scripts/daily-run-state.mjs status --date=YYYY-MM-DD`。`reconcile` 按来源终态、去重候选数量、逐项证据和Steam冻结发现面计算真实缺口；后续轮次只处理 `shortfall>0`、`evidenceComplete=false`、`frozenDiscoveryComplete=false`、未就绪或未发布的频道和栏目。已就绪/已发布频道禁止重做，禁止由任务自行手写 `missingSections` 掩盖真实缺口。

## 检索并行边界

- 开始新检索前先读取当天 `research-ledger.jsonl`，跳过已经有合格终态的来源，避免跨轮重复访问。
- 互不依赖、只读且不需要根据上一结果改变检索方向的来源可以成组并行查询；单批最多四个搜索请求。每批结束后先按北京时间时效、权威性、重复项和字段完整性统一筛选，再进入下一批。
- 需要语义判断、来源追踪、页面二次点击或失败重试的查询保持直接执行，不为追求并行而提前决定结论。
- 并行只适用于网页发现和只读取证。`research-ledger.jsonl`、审计快照、候选 JSON、索引、渲染、就绪证明、发布和 Git 操作仍由持有租约的单一任务顺序写入。
- 每个来源的结果只写一次终态；批量查询部分失败时只重试失败项，不重复已经成功的调用。所有最终采用内容都必须保留可追溯链接和检索时间。

## 检索账本与审计

每完成一个来源站点或来源类别，立即记录，不得等任务末尾回忆补写：

`node scripts/daily-run-state.mjs record --date=YYYY-MM-DD --run-id=HHMM --channel=minsheng --section=domestic --source=新华网 --tier=primary --status=accepted --url=https://... --available=3 --rejected=1 --reason=重复1条 --candidates=id-1|id-2`

Steam 优惠的确定性发现面是 Steam 官方 Specials 默认相关性首个结果页的全部游戏卡片，加上冻结前当天国内权威优惠报道或价格历史清单中额外出现且能回到 Steam 官方商品页核验的热门史低；不是 Steam 数千项折扣总目录。05:00开始发现，最迟08:00把去重 appId 写入分次快照并执行：

`node scripts/daily-run-state.mjs steam-freeze --date=YYYY-MM-DD --run-id=HHMM "--source-url=https://store.steampowered.com/search/?specials=1&cc=cn&l=schinese" "--app-ids=ID1|ID2|..." "--extra-app-ids=IDx|IDy|..."`

冻结文件创建后，当天后续轮次只复核这组 appId 的国区价格、截止时间和价格历史；页面刷新出现的新排序、新卡片或数量变化不得覆盖冻结发现面。失效或不合格项从最终合格集淘汰即可，不要求追逐10:30或11:31的新动态首屏。终态记录必须使用 `--coverage-complete=true`。`steam-cn` 的 `--candidates` 写冻结发现面内全部最终合格 Steam appId，`--available` 必须与该清单数量一致；候选JSON优惠必须与清单完全相同。`steam-price-history` 的候选ID至少覆盖所有标记为新史低/平史低的 appId。网页渲染全部合格项，静态PNG（以及今后若增加的PDF）只显示排序前6项。

允许状态为：

- `started`：已开始但尚未完成，不能通过门禁。
- `accepted`：完成该来源核验并取得可用候选。
- `rejected`：完成核验但候选全部因时效、重复、权威性或字段缺失被淘汰。
- `exhausted`：完成核验但没有符合窗口的新候选。
- `unavailable`：实际访问失败；同一频道、栏目和来源至少记录两次真实失败才算终态。

标准来源 ID、别名和各栏目必查集合只取自 `config/daily-sources.json`。不得自行用“新华社／新华网”一类组合名称替代标准名称；脚本会兼容旧别名并写回“新华网”“中国科技网”等标准名称。

民生每次运行写独立审计快照：

- `artifacts/operations/YYYY-MM-DD-HHMM-source-audit.json`
- `artifacts/operations/YYYY-MM-DD-1101-source-audit.json`
- `artifacts/operations/YYYY-MM-DD-1131-source-audit.json`

然后运行 `node scripts/merge-source-audits.mjs --date=YYYY-MM-DD` 生成发布脚本使用的 `YYYY-MM-DD-source-audit.json`。后一次任务不得直接覆盖前一次快照。

每条 `accepted` 记录必须通过 `--candidates` 写去重候选ID。游戏整合包和Mod只有在候选数量分别达到10和6，且每个候选的热度证据或版本/加载器/日期均已逐项核验后，才能在最终一条或多条记录上使用 `--evidence-complete=true`。仅写 `availableCount`、来源终态或候选名称清单不能通过门禁。

民生国内必查来源全部取得终态但候选仍不足时，允许的回退候选分别以来源类别 `外网权威新闻／机构来源`、`外网原始科技／AI来源` 或 `境外交易所／数据服务` 写入账本，并使用 `tier=fallback`；候选JSON仍保存实际机构名和链接。可选回退类别不属于每日必查集合，国内候选已经填满时不得为它们额外检索。

在判断“证据不足”或调用任一发布脚本前，必须运行：

`node scripts/check-research-completeness.mjs --date=YYYY-MM-DD`

命令现在同时检查来源终态、各栏目真实去重候选数、整合包/Mod逐项证据和Steam冻结状态。失败输出的 `candidateCount/target/shortfall` 是下一轮唯一缺口清单；失败表示仍是“尚未搜完”，不得报告“素材不足”。发布脚本也会再次执行同一门禁。

## 制作、渲染与发布

- 游戏整点轮：05:00发现Steam并启动新闻；06:00完成features/news；07:00集中完成整合包热度和Mod逐项证据；08:00最迟冻结Steam发现面并逐项核价；09:00按 `shortfall` 补缺并生成候选；10:00禁止重建Steam发现面，只完成冻结清单复核、图片、统一渲染与预检。
- 民生半点轮：05:30完成国内/国际；06:30完成科技/AI/数据；07:30补真实候选与元数据；08:30对已穷尽国内来源的栏目立即使用规则允许的外网权威来源补精确差额；09:30按 `shortfall` 补缺并生成候选；10:30只完成门禁修正、统一渲染与预检。每轮只要仍有允许的回退来源、`shortfall>0` 或证据未闭环，就必须继续推进，不得在几分钟内以“阶段结束”为由提前退出。
- 10:25—10:40：从候选池生成 `data/.pending/minsheng/YYYY-MM-DD.json` 和 `data/.pending/YYYY-MM-DD.json`。民生为 10/10/10/5；游戏为 2 features、10 news、10 packs、6 mods、当天全部已核验合格 deals（至少6项、无上限）、4 trends。
- 新游戏期次每个 pack 必须包含当天或前一天的 `heatEvidenceAt` 和可追溯的 `heatSignals`；整合包自身不要求当天发布。Mod 只有模板允许时可回退30天。
- 10:40—10:50：分别调用两个技能的统一 `render.mjs`，使用 `--scale 2 --validate true`，HTML与PNG必须来自同一候选JSON。工作版写入 `artifacts/operations/YYYY-MM-DD-render/`，公开PNG与桌面成品按模板路径复制。
- 10:50后冻结栏目，只修复校验错误。依次执行来源完整性、Steam冻结发现面与全量覆盖一致性、两个频道校验器、归档一致性、嵌入构建、站点测试、站点构建和构建验证。Steam 优惠可能连续多日有效，因此不套用新闻栏目的固定URL重复上限；改由当天冻结发现面、`coverageComplete` 账本、实时价格、截止时间和史低证据重新证明。
- 通过全部预检后，必须为每个频道生成就绪证明。以下参数均使用实际绝对或仓库相对路径：

  `node scripts/daily-run-state.mjs mark-ready --date=YYYY-MM-DD --channel=minsheng --candidate=data/.pending/minsheng/YYYY-MM-DD.json --html=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-民生日报.html --png=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-民生日报.png --public-png=downloads/minsheng/YYYY-MM-DD.png`

  `node scripts/daily-run-state.mjs mark-ready --date=YYYY-MM-DD --channel=game --candidate=data/.pending/YYYY-MM-DD.json --html=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-游戏简报.html --png=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-游戏简报.png --public-png=downloads/game/YYYY-MM-DD.png`

  就绪证明记录候选、HTML和PNG哈希；发布脚本会重新计算并拒绝任何就绪后改动、缺失或非3840px的PNG。
- 11:00后两个频道独立调用 `publish-minsheng.mjs` 与 `publish-brief.mjs`。成功一个就保留一个，失败频道继续展示上一期。
- 发布后重建、测试、提交并推送 `main`，等待 Pages，再运行 `node scripts/check-daily-health.mjs --live=https://springhues.com --save`，将完整结果保存为当天 `health.json`。
- 保存健康检查或完成11:31补跑后，运行 `node scripts/sync-admin-logs.mjs --kind=maintenance --date=YYYY-MM-DD --push`。同步失败只保留 warning 和本地 operation 文件，不得回滚已发布日报；下一轮以同一命令幂等补传。
- 公开 `downloads/` PNG、站点发布和线上健康是发送成功的硬门禁。桌面历史镜像仍须尝试且不得覆盖旧文件；若仅因无人值守权限导致桌面镜像失败，在操作记录中标记 `DESKTOP_MIRROR_PENDING`，不撤销已验证的网站发布，由11:31再次补拷贝。

## 11:01与11:31决策顺序

1. 读取健康检查的 `healthy`、`degraded`、`warnings`、`reasonCodes`、`transport` 和每频道 `content/png/deployment`。
2. 今日双频道全部健康：只记录结果并补做尚未完成的桌面镜像，不重做内容、不发布、不触发Pages。
3. 本地正式内容与PNG健康、仅线上部署失败：只处理部署，不重新生成内容。
4. 正式内容缺失但pending合法：继续渲染、复制PNG、校验和发布。
5. 语义门禁显示研究未完成：只补 `shortfall`、未闭环证据或未完成的冻结清单价格核验；沿用当天账本和08:30前冻结的Steam发现面，不覆盖此前审计快照，不得重新扫描动态Steam首屏。11:31只处理11:01留下的明确失败项。
6. TLS证书异常且同域HTTP只读复核完整：视为 `healthy=true, degraded=true`，只报告TLS待修复。
7. 只有来源完整性门禁通过后仍缺素材、频道内容无效、PNG无效、归档门禁失败或Pages明确失败，才按失败处理并通知人工。

每次完成阶段后用 `daily-run-state.mjs checkpoint` 更新 `stage`、频道状态和缺失栏目。所有同日操作必须幂等，已发布频道不得覆盖。

## 发送成功判定

同时满足以下条件才报告“每日发送成功”：

1. 两个索引和正文均为当天、期号连续且 `publishAt` 为当天11:00。
2. 两频道发布脚本分别成功，构建与Pages工作流成功。
3. 线上门户、两频道最新期、至少一个历史期均返回200，页面日期、归档值和下载文件名一致。
4. 两个当天PNG实际请求成功、`Content-Type=image/png`、非空且宽度3840px。
5. `check-daily-health` 为 `healthy=true`；只允许规则定义的TLS证书问题表现为 `degraded=true`。

任何一项未满足都保留上一期有效内容，并在11:31精确重试；11:31后仍失败才通知人工，不得伪造成功。

## 本地性能与产物维护

- `artifacts/operations/` 是当天接力状态和就绪证明的一部分，任何自动清理都不得删除当前日期或尚未发布日期的内容。
- 普通修改使用快速验证链路：`node scripts/test-site.mjs`、`node scripts/test-daily-operations.mjs`、`node scripts/build-site.mjs`。只有日报制作或视觉变更才运行网页检索、浏览器渲染和 3840px PNG 检查。
- `powershell -NoProfile -File scripts/perf-check.ps1 -RunChecks` 输出工作区规模、Git 状态耗时及三条快速验证的基准数据。
- `powershell -NoProfile -File scripts/local-maintenance.ps1 -MinimumAgeDays 14` 默认只预览可归档的非运行产物；必须显式增加 `-Archive` 才会复制、逐文件校验并移出工作区。旧 `artifacts/operations/YYYY-MM-DD-render/` 还必须显式增加 `-ArchiveOperationRenders`，操作状态 JSON 始终留在仓库工作区。
- 维护脚本不得自动运行，不得添加杀毒软件排除项，也不得处理 `.git/`、`downloads/`、`data/.pending/` 或 `artifacts/operations/` 中的非渲染状态文件。
