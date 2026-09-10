# 双频道日报运行手册

本手册是 Springhues 日报运行流程的唯一详细来源，适用于游戏制作、民生制作、发布与补跑三个现有任务。项目 AGENTS 负责路由与核心约束；模板技能负责内容标准和渲染契约；提示词只说明角色、入口、阶段目标及必要限制。脚本能力以实际实现为准，不能通过文档虚构接口。

## 不可变约束

- 时区固定 `Asia/Shanghai`，`publishAt` 固定当天 11:00；11:00 前禁止调用发布脚本。
- 现有调度不变：游戏每天 05:00—10:00 每小时整点；民生每天 05:30—10:30 每小时半点；发布补跑每天 11:01、11:31。三个任务继续为本地项目的独立 cron 运行，模型、推理强度、项目、状态、通知策略不由本手册改动。
- 每次计划运行是新任务，不回到旧聊天；同日接力读取仓库结构化状态。禁止用 heartbeat 替代或新增定时任务绕过本轮边界。
- 禁止 OpenAI Platform API、`OPENAI_API_KEY`、`api.openai.com` 和任何付费模型 API；每日研究仅使用当前 Codex 任务自带网页检索，不调用 ImageGen 绘制正文。
- 保留模板的数量、国内来源优先级、时效、逐项证据、所有合格 Steam 项及最近七期去重规则。不得复制上一期、伪造日期、来源或证据。
- 保留用户未提交和无关改动、已就绪/已发布成果、冻结清单、账本和审计快照。同日写入须持租约且幂等；检查失败禁止发布受影响频道，但不禁止诊断和范围内修复。
- 日报提交推送授权不包含外部日志等其他载荷。外发须已有对应授权并遵守环境审批；不暴露凭据、不自行变更云服务或安全配置。
- 定时任务依赖开机、网络与 Codex 桌面应用运行；关机、休眠或应用退出造成的缺口只能在恢复后按实际状态接续。

## 状态优先入口

只读审计和规则文档修改不执行以下写入步骤，不读取当日新闻正文来模拟制作。每日实际运行按以下顺序：

1. 计算北京时间日期及本轮 HHMM，确认频道和授权目标，查 Git 状态。先读本节、下一节及结构化摘要：当日 `run-state.json` 的 `stage/channels/runs`、readiness 中本频道路径/哈希、索引中当日记录与最新期号，以及发布轮所需的 health 日期、检查时间和分频道结果。文件不存在就记录不存在，不等于必须重做内容。路径均在 `artifacts/operations/YYYY-MM-DD-*`，由 `operationPaths` 定义；健康结果为 `YYYY-MM-DD-health.json`。
2. 获取共享租约后才执行 init、reconcile、账本、候选、审计、渲染、公开 PNG、发布或健康结果保存。制作 TTL 为 3000 秒，发布补跑为 1500 秒：

   `node scripts/daily-run-state.mjs lease-acquire --date=YYYY-MM-DD --run-id=HHMM --ttl=3000`

   发布轮将 ttl 改为 1500。`acquired=false` 时只报告被有效租约占用并结束；不 init、不 checkpoint、不释放别人的租约。TTL 是互斥有效期，不是允许无限工作或占用下一轮的时长；每个大阶段及长阶段中到期前以同一命令、同一 run-id 续租并检查 acquired，失败即停止写入。
3. 幂等注册本轮：

   `node scripts/daily-run-state.mjs init --date=YYYY-MM-DD --run-id=HHMM --kind=main --minsheng-issue=N --game-issue=N`

   发布补跑使用 `--kind=recovery`。仅首次创建状态确需两个 issue 时，分别读取双索引 editions 的 date/issue/file/publishAt 必要字段：无当天归档用最大期号 + 1，已有当天归档沿用当天期号。已有状态时 init 不补写 issue，省略两个参数；发现已有 issue 为空或与归档冲突须诊断，不能靠重跑 init 覆盖。
4. 先用 `node scripts/daily-run-state.mjs status --date=YYYY-MM-DD --channel=game` 只读查询本频道（民生用 minsheng；省略 channel 保留双频道返回），再在持租约时执行 `node scripts/daily-run-state.mjs reconcile --date=YYYY-MM-DD --channel=game --run-id=HHMM`。status 返回 `apiVersion=state-evidence/v1`、研究、stored 标签、readiness、archive、online、publication、原因及租约摘要，不隐式 init/reconcile/取租约。reconcile 依据文件、内容门禁及哈希恢复；冲突返回 `ok=false, code=STATE_CONFLICT` 且不改原状态，不能盲目重写历史。单频道 reconcile 保留另一频道字段，仅重算共享 stage。
5. 按状态阅读本手册所需章节和本频道模板，不预先全文读取两个模板、两个来源集合或两套七期正文。同一轮已读且未变化的资料复用；重新读取因实际改动、发现冲突或进入未读阶段触发。

| 当前动作 | 必要补充读取 |
| --- | --- |
| 研究/补证据 | 本频道 SKILL.md、完整 editorial-rules.md、本频道来源注册项；按频道/缺口栏目过滤当天 ledger，游戏 deals 再读冻结清单，民生读相关审计类别 |
| 候选校验 | 本频道内容规则（若未读）、候选、民生同日合并审计、本频道索引必要字段；优先调用现有归档检查器 |
| 渲染/视觉修复 | 本频道 SKILL.md 渲染与 Output、layout-spec.md、相关网页源码与渲染器接口；仅图库预览或元数据任务才读 artifact-template.json/reference.png |
| 已 ready 的核验/发布 | 本频道 readiness、关联文件哈希、校验器和本手册发布步骤；证明有效时无需重读全部编辑/布局材料或重渲染 |
| 已归档/仅部署恢复 | 当日正式索引记录、正式内容/公开 PNG、健康结果、目标提交及 Pages 状态；不读取未使用的模板或重建候选 |

最近七期规则不变：`archive-consistency.mjs <game|minsheng> <候选JSON>` 负责标题/URL 去重、期号和日期门禁。检查器内部目前会读取本频道全部归档再选择最近七期比较；不要求代理在上下文里再全文读取七期。只有失败时查看命中的条目及必要来源，不手工复刻去重规则。已归档频道不再运行“新候选发布一致性”来覆盖正式数据，改用健康检查中的归档校验。

## 状态字段与完成语义

以下取自 daily-run-state.mjs、daily-operations.mjs、发布和健康脚本的现有行为，不是新增枚举：

| 层级 | 实际字段/值 | 使用方式 |
| --- | --- | --- |
| 单轮执行 | `runs[].status`：init 写 running；checkpoint 接收 `--run-status=complete\|failed` 并写 finishedAt | complete 表示正常收尾，包括到真实边界保存接力、ready 等待发布、无须重做；failed 表示本轮尚有未修复错误或硬阻塞。两者均不表示日报发布完成 |
| 频道进度 | `channels.<channel>.status`：pending、researching、researched、ready、publishing、published；另有 issue、missingSections、published 布尔值 | reconcile 写 researching/researched；mark-ready 写 ready；发布脚本写 publishing/published。published 只证明本地发布步骤，不能代替线上证据 |
| 全局阶段 | 初始化/协调/发布产生 research、candidate、ready、publish、published | deriveStage 按双频道状态汇总；仅两频道 published 均为 true 时为 published。仍须分别核验文件与线上证据，不能用全局阶段证明双频道发送成功 |
| 研究摘要 | `channels.<channel>.sections.<section>` 的 candidateCount、candidateIds、target、shortfall、missing、incomplete、evidenceComplete、evidenceMissingIds、frozenDiscoveryComplete | 数量来自账本当前有效集合；撤销/淘汰会减少数量。旧 ID 和布尔标记不能单独证明证据完成；来源事实仍需人工逐项核验 |
| 就绪证明 | `readiness.channels.<channel>` 的 candidateSha256、htmlSha256、pngSha256、width、verifiedAt、preflight 及路径 | mark-ready 运行集中预检；绑定本频道研究、正文、审计/冻结、七期归档、渲染和视觉记录。任一相关依赖变化都必须重新证明 |
| 线上健康 | health 的 healthy、degraded、warnings、reasonCodes、transport，以及 `channels.<channel>.local/live.content/png/reachability/page/deployment` 的 valid | 未传 --live 的 healthy 只有本地含义；顶层 healthy 汇总本次选定范围，省略 --channel 为双频道，指定后仅代表该频道。单频道成功不能证明双频道发送成功 |

checkpoint 校验 stage/status/runStatus 枚举，不新增 waiting、blocked、done、day-complete 等状态值。退出原因独立使用 `--exit-reason=READY_WAITING_PUBLISH|ONLINE_HEALTHY|CONFIGURED_BUDGET|ENVIRONMENT_LIMIT|HANDOFF_BOUNDARY|SOURCE_EXHAUSTED|PERMISSION_REQUIRED|LEASE_LOST|REPAIRABLE_ERROR|HARD_BLOCKER`；镜像用频道 `--mirror-status=pending|complete|conflict`，对外仍可报告 DESKTOP_MIRROR_PENDING。预算退出须附 `--budget-file=<JSON>`，含 `kind=configured|environment|handoff`、`deadlineAt`、`basis`，与退出原因匹配。可修复错误不能作为 run complete 的理由。旧调用可省略退出原因，但不能据此声称预算已验证；不要手写 missingSections 掩盖缺口。

状态写入均要求同日有效租约，显式 runId 必须匹配；旧 JS 调用省略 runId 时仅兼容已有唯一有效租约，不自动获取。新调用须显式传 runId。短期写锁串行化状态更新，JSON 先写唯一临时文件再替换；替换前再次检查租约。遗留 `YYYY-MM-DD-state-write.lock`、损坏租约或状态冲突保留供诊断，不自动删除后继续。租约不是跨主机分布式锁，也不保证断电后的磁盘耐久性。

每批证据及时落盘，每大阶段可 checkpoint；检查点不是退出条件。正常收尾先 reconcile，再仅结束当前 run：

`node scripts/daily-run-state.mjs checkpoint --date=YYYY-MM-DD --run-id=HHMM --run-status=complete --exit-reason=READY_WAITING_PUBLISH`

此例仅适用于确已就绪等待发布，其他情况填写实际原因，不能照抄。

研究缺口诊断的预期非零退出不单独决定 run 失败：仍有可执行后续、仅到实际预算边界且进度已保存时用 complete。网站健康而镜像或未获授权的外部日志待补，作为独立 warning 报告。有未修复操作错误或无可执行路径的硬阻塞则用 failed，并报告证据和下一步。结束 run 时不要附带频道 status、published、missing 或全局 stage 来伪造完成。无论前序命令是否失败，都在 finally 中尝试：

`node scripts/daily-run-state.mjs lease-release --date=YYYY-MM-DD --run-id=HHMM`

无法落盘或释放须如实报告，不能假称接力已保存；失去租约后不再改状态。

## 按状态连续推进与时间优先级

时间表规定工作优先级和最晚计划目标，不是进入下一阶段的开放时间。状态满足依赖就同轮继续，不空等钟点；状态未满足则继续补缺，不因已经进入“渲染轮”跳过研究。唯一硬发布时间边界仍是 11:00。

| 频道/轮次 | 优先事项与最晚计划目标 |
| --- | --- |
| 游戏 05:00/06:00 | 05:00 开始 Steam 发现与 features/news；06:00 优先完成 2 焦点、10 新闻 |
| 游戏 07:00/08:00 | 整合包热度与 Mod 逐项证据；最迟 08:00 固定 Steam 发现面，之后只核验冻结 appId |
| 游戏 09:00/10:00 | 09:00 轮争取候选生成并校验；10:00 轮完成仍缺的证据、图片、统一渲染、公开 PNG、mark-ready |
| 民生 05:30/06:30/07:30 | 依次优先国内/国际、科技/AI/数据、真实候选与元数据补缺；已完成的栏目不重复 |
| 民生 08:30 | 国内必查来源逐项穷尽而仍不足的栏目立即用允许的外网权威来源补精确差额；若更早满足回退条件，无须等到此时 |
| 民生 09:30/10:30 | 09:30 轮争取候选生成并校验；10:30 轮完成缺口修正、统一渲染、公开 PNG、mark-ready |
| 两频道 10:50 后 | 以最终校验修复和剩余硬缺口为优先，避免非必要换稿；未达标仍可补证据、重生成受影响产物，不把“冻结栏目”当成禁止修复 |
| 发布 11:01/11:31 | 先推进已满足门禁频道的发布/部署，避免等另一频道研究；随后补明确缺口。11:31 接续当日状态中的遗留项，不重启完整生产 |

删除原先 10:25—10:40 才生成候选、10:40—10:50 才渲染的第二套时段。研究门禁通过就生成候选；候选合法就校验、渲染并就绪，允许早于表中时间。09:00/09:30 候选目标错过要报告实际缺口，不能降低标准；10:00/10:30 轮不得把仍可执行的工作无故留给发布轮。

继续条件：本频道有 missing/incomplete 来源、shortfall、未闭环证据、需要处理的冻结清单、未生成/未合法候选、未有效就绪产物，或发布轮仍有已授权发布/部署步骤，且有可执行的合规下一步。每完成检查点重新判断并继续。

保存退出条件仅限：

- 本频道已有效 ready 且本轮为制作，或 11:00 前所有目标已 ready：保存状态、释放租约，等待现有发布任务，不占着任务空等。
- 目标已线上健康：只尝试仍欠的镜像等授权附属项；已有成果不重做。
- 配置执行预算、真实环境限制或接力边界将至：开始时分别记录预算策略、可核验环境期限和下一轮接力时间，采用适用的更早边界。既有默认 25 分钟、最后 2 分钟收尾是**未验证的预算策略**，不是 Codex 硬限制、租约 TTL 或“工作已足够”的证明；按该策略收尾须报告 CONFIGURED_BUDGET，不能写 ENVIRONMENT_LIMIT。本轮代码不延长生产运行、不改变调度。
- 外部条件确实不可推进，或已逐项穷尽允许来源/回退且证据仍不足：保存真实进度和具体阻塞，禁止无效重复尝试。
- 需额外权限、不可逆操作、未授权代码/云配置修复，或租约丢失：停止受影响写入，保留其他可独立完成的工作；说明需要人工介入的动作和原因。

单个来源一次失败、一次非零检查退出、某小阶段结束或双频道聚合失败均不是整轮停止条件。11:01 可恢复项留精确接力；11:31 后仍失败应在结果中明确人工待办。权限阻塞、状态损坏或无法安全续跑可提前报告，不要求等 11:31；实际通知仍按现有任务通知策略，不另发消息、不新增监控。

2026-09-11 只读抽样 09-06、09-08、09-09、09-10 共 55 轮：时长范围 1.29—33.03 分钟，3 轮超过 23 分钟，1 轮超过 25 分钟。样本无退出原因、阶段起止和收尾耗时，不能推出 25/2 足够，也不能从短轮次直接认定提前停工。建议在后续获准生产验收中连续记录至少 7 天每阶段起止、实际退出原因、剩余缺口、收尾耗时及环境期限，分别计算阶段和收尾 P95，再评估预算；不以模拟计时替代现实证据。详细样本哈希见 B 报告。

## 检索并行边界

- 开始新检索前按频道/缺口栏目读取当天 `research-ledger.jsonl`，复用已有合格终态和证据，避免跨轮重复访问同一结果；仍有缺口时可检索同一来源尚未核验的页面或允许的回退路径，不能把一次 accepted 当成该来源所有内容已经穷尽。
- 互不依赖、只读且不需要根据上一结果改变检索方向的来源可以成组并行查询；单批最多四个搜索请求。每批结束后先按北京时间时效、权威性、重复项和字段完整性统一筛选，再进入下一批。
- 需要语义判断、来源追踪、页面二次点击或失败重试的查询保持直接执行，不为追求并行而提前决定结论。
- 并行只适用于网页发现和只读取证。`research-ledger.jsonl`、审计快照、候选 JSON、索引、渲染、就绪证明、发布和 Git 操作仍由持有租约的单一任务顺序写入。
- 同一结果不重复记账；两次真实 unavailable 尝试分别记录，后续补核验可追加可追踪记录，不覆盖旧行。批量查询部分失败时只重试失败项，不重复已经成功的调用。所有最终采用内容都必须保留可追溯链接和检索时间。

## 检索账本与审计

每完成一个来源站点或来源类别，立即记录，不得等任务末尾回忆补写：

`node scripts/daily-run-state.mjs record --date=YYYY-MM-DD --run-id=HHMM --channel=minsheng --section=domestic --source=新华网 --tier=primary --status=accepted --url=https://... --available=2 --rejected=1 --reason=重复1条 "--candidates=id-1|id-2"`

需要闭环的记录另传 `--evidence-file=<JSON数组>`，元素含 `id, decision=accepted|rejected, url, checkedAt, basis`，接受项还须含非空 `facts`。HTTPS 来源与同日检索时间必填；facts 记录事实值及取证依据，不能只写“已核实”。程序只核验结构、身份、日期和一致性，不替代来源核验。撤销用 `--revoke-candidates=id-1|id-2 --reason=具体原因`；更新证据可为同一 ID 追加记录，历史不覆盖。重复内容默认幂等；显式 `--event-id` 重试同一记录，若同 ID 内容冲突则失败。重新接受已撤销内容必须新 eventId 并带新证据。两次真实 unavailable 须独立 attempted-at/event-id，不得重复一次失败充数。

Steam 优惠的确定性发现面是 Steam 官方 Specials 默认相关性首个结果页的全部游戏卡片，加上冻结前当天国内权威优惠报道或价格历史清单中额外出现且能回到 Steam 官方商品页核验的热门史低；不是 Steam 数千项折扣总目录。05:00开始发现，最迟08:00把去重 appId 写入分次快照并执行：

`node scripts/daily-run-state.mjs steam-freeze --date=YYYY-MM-DD --run-id=HHMM "--source-url=https://store.steampowered.com/search/?specials=1&cc=cn&l=schinese" "--app-ids=ID1|ID2|..." "--extra-app-ids=IDx|IDy|..."`

冻结文件创建后，当天后续轮次只复核这组 appId 的国区价格、截止时间和价格历史；页面刷新出现的新排序、新卡片或数量变化不得覆盖冻结发现面。失效或不合格项从最终合格集淘汰即可，不要求追逐10:30或11:31的新动态首屏。Steam 覆盖核验完成的终态记录使用 `--coverage-complete=true`；只有整组冻结 appId 均有合格或淘汰依据时才可声明覆盖完整。`steam-cn` 的 `--candidates` 写冻结发现面内全部最终合格 Steam appId，`--available` 必须与该清单数量一致；候选JSON优惠必须与清单完全相同。`steam-price-history` 的候选ID至少覆盖所有标记为新史低/平史低的 appId。网页渲染全部合格项，静态PNG（以及今后若增加的PDF）只显示排序前6项。

若 08:00 后仍缺冻结文件，只能从已保存的截至 08:00 的当天发现证据恢复原清单，并保留实际恢复时间；无该证据则标记游戏阻塞，不能重新抓动态首屏、冒称按时冻结或伪造时间，民生继续独立推进。

账本允许状态为：

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

完整性检查是诊断入口，不要求先有完整候选或数量达标。研究中、候选生成后和发布前均可按本频道运行：

`node scripts/check-research-completeness.mjs --date=YYYY-MM-DD --channel=<game|minsheng>`

检查来源终态、当前有效候选集合、逐项证据和冻结文件的内容/日期/身份/状态绑定哈希；游戏 pending 存在时另查全量优惠覆盖及每个冻结 appId 的接受或淘汰依据。冻结创建强制当天 08:00 前；缺失、迟到、损坏或哈希不符均失败，不重扫动态集合。缺少 pending 时输出 `dealCoverage.skipped=true, code=CANDIDATE_MISSING`，可用 `--require-candidate=true` 将其设为硬失败；最终就绪始终要求完整候选。失败输出共同决定下一步；非零退出禁止未达标发布，但允许诊断和授权范围修复。只有逐项穷尽允许路径且有真实缺口证据，才报告来源不足。

## 候选、渲染与频道就绪

对每个未发布频道独立执行，已有文件先验证再复用；完整性诊断可在任何阶段运行，成品和发布必须通过所有对应硬门禁。

1. 研究及逐项证据通过后写本频道候选：民生 `data/.pending/minsheng/YYYY-MM-DD.json`，游戏 `data/.pending/YYYY-MM-DD.json`。数量、来源优先级、时效窗口和元数据完全遵守本频道 editorial-rules；民生 10/10/10/5、至少六类数据、三头条引用，游戏 2/10/10/6/全部合格优惠（至少 6）/4。不能以账本累计 ID 达标替代最终 JSON 验证。
2. 民生先写本轮独立来源审计快照并合并，再运行本频道完整性检查、正文校验器和最近七期归档门禁；游戏候选存在时完整性检查还必须返回有效 dealCoverage。具体命令见验证映射。
3. 用本频道技能统一渲染器：

   `node <skill-directory>/scripts/render.mjs --project-root <repo> --brief <候选JSON> --html-out <HTML> --png-out <PNG> --scale 2 --validate true`

   工作产物写 `artifacts/operations/YYYY-MM-DD-render/`。HTML 和 PNG 必须来自同一个候选 JSON；渲染器使用真实网页并检查桌面/移动快照一致性。只改一个频道时只渲染该频道；共享视觉变更才渲染两个频道。
4. 用 `view_image` 原始精度检查本频道最终 PNG，确认准确宽 3840px、无缺字/裁切/溢出、图片和日期链接正确。公开 PNG 复制到 `downloads/<channel>/YYYY-MM-DD.png`，与渲染 PNG 哈希一致。游戏网页和可编辑 HTML 保留全部合格 Steam 项，静态 PNG 只显示排序前 6 项。
5. 完成本频道预检后创建就绪证明（使用实际路径）：

   `node scripts/daily-run-state.mjs mark-ready --date=YYYY-MM-DD --run-id=HHMM --channel=minsheng --candidate=data/.pending/minsheng/YYYY-MM-DD.json --html=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-民生日报.html --png=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-民生日报.png --public-png=downloads/minsheng/YYYY-MM-DD.png --render-evidence=artifacts/operations/YYYY-MM-DD-render/minsheng-render-evidence.json --visual-evidence=artifacts/operations/YYYY-MM-DD-render/minsheng-visual-evidence.json`

   `node scripts/daily-run-state.mjs mark-ready --date=YYYY-MM-DD --run-id=HHMM --channel=game --candidate=data/.pending/YYYY-MM-DD.json --html=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-游戏简报.html --png=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-游戏简报.png --public-png=downloads/game/YYYY-MM-DD.png --render-evidence=artifacts/operations/YYYY-MM-DD-render/game-render-evidence.json --visual-evidence=artifacts/operations/YYYY-MM-DD-render/game-visual-evidence.json`

   每次只执行相关频道命令。两份证据文件必须在实际渲染/检查后建立，不能从 PNG 宽度推导视觉通过。渲染记录字段为 `date,channel,renderer:"render.mjs",scale:2,validate:true,checkedAt,candidateSha256,htmlSha256,pngSha256`；视觉记录为 `date,channel,method:"view_image",result:"pass",inspector,inspectedAt,pngSha256,findings:[]`。未有真实原图观察不能填 pass。当前模板渲染器不自动生成这两份新记录，操作者须据实际输出和观察落盘；本轮未修改模板。

   `node scripts/daily-preflight.mjs --date=YYYY-MM-DD --channel=game --require-ready=true` 可只读复核已有就绪证明；创建前可用上述候选/产物/证据参数独立预检。JS 的 `preflightChannel` 返回命名 gates、identity 哈希、reasons、dependencyHashes，失败 CLI 退出 1。mark-ready 复用同一门禁，绑定本频道账本、审计/冻结、七期归档及证据文件哈希。产物或相关依赖变化须重跑受影响校验、真实渲染/观察和 mark-ready，不修改旧哈希冒充通过。
6. 桌面镜像按模板的月份目录复制 HTML、PNG 和兄弟资源目录，只处理本日期。目标已存在且内容一致就复用；内容不一致不覆盖已有历史，记录 conflict。权限导致失败时用 checkpoint 的频道 `--mirror-status=pending` 并报告 DESKTOP_MIRROR_PENDING，不撤销 readiness；发布补跑只重试缺失拷贝。

已 ready 再次进入：status/reconcile 均复核必要门禁和哈希。冲突保留原文件与标签并返回原因；只修复该频道实际错误，证据重新齐备后可重新 mark-ready。已 published/publishing 频道禁止 mark-ready；有中断发布时使用对应事务恢复。旧 readiness 缺集中预检或视觉记录会安全失效，不能自动补字段升格；先保留已发布产物，安排真实证据补核，不重做历史候选。

## 发布与精确恢复

以下仅适用于已获授权的正式发布任务，规则修改或只读审计不得执行。

1. 发布轮读现有健康结果以定位问题，但旧检查不能证明本轮线上状态；需要确认时运行：

   `node scripts/check-daily-health.mjs --date=YYYY-MM-DD --channel=game --live=https://springhues.com --target-commit=<40位SHA> --evidence=<已采集证明JSON> --save`

   保存须持租约。民生用 channel=minsheng；省略 channel 保留双频道检查。单频道保存 `YYYY-MM-DD-game-health.json` 或 `-minsheng-health.json`，双频道保留 `YYYY-MM-DD-health.json`，不覆盖另一频道证明。读取顶层和各频道 local/live 的 content/png/reachability/page/deployment；CONTENT_MISSING 不阻止另一 ready 频道继续。

   C 的健康接口要求证明 JSON 含 `deployment`、`pages.game/minsheng`、可选 mirror。页面证明为 `method:browser,checkedAt,url,displayedDate,selectedDate,downloadUrl`；Pages 证明为 `source:github-pages-api,checkedAt,headSha,conclusion:success,siteUrl,evidenceUrl`，对应完整目标 SHA 和站点的 Pages build API。证明默认不得早于检查 15 分钟、不得超前 60 秒。仅在已授权只读采集后提供；HTTP 200 只记 reachability，不等于页面/部署通过。生产门户及历史交互仍需额外验收。CLI 不自动获取凭据或生成浏览器证明。

   本仓库使用 Actions 部署，旧 `/pages/builds/latest` 可能返回 404。此时从仓库 deployment、对应 status 和 `.github/workflows/pages.yml` workflow run API 采集真实记录。使用 `source:github-actions-pages-api`，保留上述时间、目标 SHA、成功结论、站点和 evidenceUrl（deployment API URL），并附 `deployment`、`deploymentStatus`、`workflowRun` 三份原始 API 对象。校验器核对同仓库/部署/运行关联、github-pages 环境、目标 SHA、成功状态及站点；不能改造 URL 冒充旧 build 证明，也不能仅凭某个 Actions 测试成功当作部署成功。新增兼容检查：`node scripts/test-pages-deployment-proof.mjs`。
2. 先处理已 ready、尚未发布的频道：独立复核本频道完整性、正文、归档、覆盖（游戏）、readiness 和时间门禁，11:00 后调用 `node scripts/publish-minsheng.mjs --run-id=HHMM` 或 `node scripts/publish-brief.mjs --run-id=HHMM`。新发布入口要求显式 run-id；状态通过 B 的 updatePublicationState 接口写入。一个频道失败不阻止另一满足门禁的频道；不以双频道完整性作为单频道前置条件。
3. 候选合法但未 ready：补本频道渲染、公开 PNG、预检和 mark-ready，然后发布。研究仍缺：仅补真实缺口和证据，沿用当天账本、审计快照与冻结 Steam appId；在本轮预算内依次推进候选至健康，不人为停在某检查点。
4. 已正式归档：先核验当日索引/正文/公开 PNG，禁止重复发布。只有本地正式文件有效、线上部署失败时，仅检查已有目标提交、推送是否到达和 Pages 执行状态，修复部署并复核线上；不重搜、不重生成 JSON/PNG、不重跑发布脚本。已有部署还在运行时等待有界进展，不能反复触发。重试同一部署需已有授权，涉及额外配置/代码的修复按范围判断。
5. 新归档后按“正式发布验证链”重建、测试和构建验证；仅提交本次发布涉及的文件，确认无无关已暂存内容，再按已有授权推送 origin/main。等待目标提交的 Pages 工作流成功并运行新鲜线上健康检查。另一频道仍显示上一期可正常构建部署；全局健康尚不通过时仅报告已成功频道。
6. 发布中断时先读 `YYYY-MM-DD-<channel>-publish-transaction.json` 和 status 的 publication。C 事务按 prepared → content-written → index-written → game embedded-written → complete 推进，记录正文/PNG 和索引前后哈希；B 仅保存同事务身份/步骤，不维护第二份文件事务。持有效租约、11:00 后可用同一频道发布命令恢复同一期；只复用实际字节匹配的目标。pending 已 rename 时，预检允许该日期该频道正式正文替代，必须仍匹配 readiness 的候选哈希并通过完整门禁。未知正文、不同 PNG、非事务索引改动、事务 ID 冲突一律拒绝并保留证据；无匹配日志不可盲目重复发布或手改索引。该协议可恢复多文件中断，不是跨文件原子事务或断电耐久性保证。
7. TLS 异常只有健康脚本确认同域 HTTP 只读复核完整、返回 `healthy=true, degraded=true` 且警告仅为已定义的 TLS 证书问题时才允许降级成功；明确报告 TLS 待修复。普通请求失败不得自行绕过证书校验或判定健康。
8. 保存健康检查或完成 11:31 补跑后，外部管理员日志仅在已有该载荷外发授权且环境允许时调用 `node scripts/sync-admin-logs.mjs --kind=maintenance --date=YYYY-MM-DD --push`。未授权、失败或被审批阻止只记录 warning/待办，保留本地 operation 证据，之后在获准范围内幂等补传；不回滚已健康日报。
9. 最后按“状态字段与完成语义”结束当前 run 并释放租约。结果分别报告本轮执行、各频道研究缺口/证据、候选、ready、本地归档、Pages、线上 PNG/健康、TLS、镜像及外发待办。研究轮结束不能写成已发送，失败频道保留上一期有效内容。

## 发送成功判定

“本轮正常结束”“某频道就绪”“某频道本地已归档”分别按相应证据报告；“当天双频道发送成功”必须同时满足：

1. 两个索引和正式正文均为当天，期号连续，publishAt 为当天 11:00，页面日期、归档和下载文件名一致。
2. 两频道本地发布证据完整，readiness 所对应内容/公开 PNG 一致；构建验证及包含目标提交的 Pages 工作流成功。
3. 线上门户、两个频道的当天页面及至少一个历史期均可读取有效内容（不仅 HTTP 200）；日期深链接和下载链接正确。
4. 两个当天 PNG 实际请求成功，Content-Type 为 image/png、非空、宽 3840px；核对线上 JSON 与本地正式 JSON、线上 PNG 与 readiness/公开 PNG 的内容或哈希一致。
5. 带正确 date 和 --live 的新鲜 `check-daily-health` 返回 healthy=true；仅允许上一节定义的 TLS 降级。
6. 本轮检查点与租约收尾完成。桌面历史镜像仍须尝试，失败单独列为待补；不会改变网站已健康的结论。外部日志失败同样独立报告。

健康脚本验证目标 JSON/PNG 字节、注入的浏览器页面与目标 Pages 提交证明，但未包办门户和线上历史交互。一频道 local/live.valid 与对应 page/deployment 全通过可报告该频道线上验证；单频道 healthy=true 仍不代表双频道成功。另一频道缺失时不回滚成功频道，也不能把研究预算结束说成发布成功。

## 验证映射

本表是 AGENTS 与手册共用的唯一验证清单。按改动的实际影响选择；同一输入的检查已通过且未再改变时不重复，失败只重跑相关项。下列命令中的日期/频道/路径使用真实值，不运行占位符命令。

| 任务类型 | 必须执行的验证 | 范围与产物边界 |
| --- | --- | --- |
| 只读审计 | 核对相关文件/接口/结构化证据，报告已确认与未验证 | 不 init/reconcile，不写账本/候选；不为审计触发检索、渲染、构建或发布；status/完整性诊断可只读按需运行 |
| 文档、技能说明、提示词修改 | 差异/引用/命令字段检查，验收情景走查，git diff --check；技能 frontmatter 验证；自动化用工具更新并 view 读回，核对其余配置未变 | 不生成日报，不运行站点测试/构建/渲染来“验证文字”，不触发任务；仅提交获准项目文档 |
| 单频道正文制作/候选修复 | 本频道完整性诊断转硬门禁、正文校验、七期归档检查、游戏覆盖或民生审计、统一渲染、3840px 原图检查、公开哈希与 mark-ready | 只处理该频道；没有完整候选时可先诊断，不能以预检通过替代成品检查 |
| 单频道视觉修改 | 下述代码基础链 + 该频道渲染器、3840px 元数据/原图检查及桌面/移动快照比较 | 使用已核验输入，不因此检索当天新闻或制作另一频道；既有 ready 产物受影响时须重新证明 |
| 共享代码/样式/流程脚本修改 | 代码基础链 + 按模块追加测试；共享视觉/渲染行为影响双频道时两份统一渲染及原图检查 | 普通非视觉共享改动不强制浏览器/PNG；保护历史和另一频道产物 |
| 正式发布/部署恢复 | 发布频道全部内容与 readiness 门禁 + 正式发布验证链 + Pages 目标提交 + 新鲜线上健康与发送成功判定 | 缺另一频道当日内容不是该频道前置失败；仅部署故障复用已通过且未变化的内容/产物证明 |

代码基础链（普通代码修改，含单频道视觉修改）：

```powershell
node scripts/test-site.mjs
node scripts/test-daily-operations.mjs
node scripts/build-site.mjs
node scripts/verify-build.mjs
```

模块追加：留言/审核/Supabase 用 `node scripts/test-messages.mjs`；管理员日志用 `node scripts/test-admin-logs.mjs`；离线编辑器另用 `node scripts/test-offline-homepage-editor.mjs`。独立离线编辑器仅修改其独立文件时可只跑独立测试，触及共享站点再加基础链。

状态/证据改动追加 `node scripts/test-state-evidence.mjs`、`node scripts/test-daily-preflight.mjs`；C 发布/健康集成按其报告运行发布恢复、完整预检集成、健康证据及七期测试。所有 B 测试默认保留明确命名的隔离夹具。构建脚本仍含清理语句；本轮仅在 dist 与源 data/.pending 均不存在的新鲜隔离根运行，不借 Node/Python 绕过批量删除边界；已有产物需保留，另建隔离根验证。

频道内容门禁：

```powershell
node scripts/check-research-completeness.mjs --date=YYYY-MM-DD --channel=minsheng
node scripts/validate-minsheng.mjs data/.pending/minsheng/YYYY-MM-DD.json artifacts/operations/YYYY-MM-DD-source-audit.json
node scripts/archive-consistency.mjs minsheng data/.pending/minsheng/YYYY-MM-DD.json
```

```powershell
node scripts/check-research-completeness.mjs --date=YYYY-MM-DD --channel=game
node scripts/validate-game.mjs data/.pending/YYYY-MM-DD.json
node scripts/archive-consistency.mjs game data/.pending/YYYY-MM-DD.json
```

正式发布验证链与现有 Pages 工作流保持一致（待发布频道预检和归档后构建按依赖执行，不能用旧构建证明新归档）：

```powershell
node scripts/build-embedded.mjs
node scripts/test-daily-operations.mjs
node scripts/test-site.mjs
node scripts/test-messages.mjs
node scripts/test-admin-logs.mjs
node scripts/build-site.mjs
node scripts/verify-build.mjs
git diff --check
```

既有测试失败也须保留真实错误并判断影响，不删测试、不降低门禁、不提交无关修复；超过本次授权的代码问题另立任务。

## 验收情景决策表

本表为文档规则与现有接口的静态走查，不等于执行当天生产或验证线上状态。

| 情景 | 应执行 | 退出/成功口径 |
| --- | --- | --- |
| 已就绪频道再次进入 | status/集中预检核对完整门禁、关联文件及哈希；有效即复用，损坏保留证据并只修相关项 | 制作轮正常结束；发布轮到时发布。reconcile 冲突非零不等于允许抹除旧状态 |
| 单频道仍有缺口 | 按 missing/incomplete/shortfall/证据补本频道，其他已完成栏目复用；允许的来源继续 | 到真实预算边界保存接力，或范围穷尽后列硬阻塞；不得称频道/发布完成 |
| 检查失败但可修复 | 保留错误，定位、修复、重跑受影响检查，再推进下阶段 | 非零退出仅禁止当前未达标发布，不自动结束整轮 |
| 11:00 前全部就绪 | 核验并保存证明，checkpoint 当前 run、释放租约 | 本轮 complete、频道 ready；等待已有发布任务，不发布、不空等 |
| 仅线上部署失败 | 复用本地正式内容/PNG，检查目标提交/Pages，修复部署后线上复核 | 本地 published 不等于发送成功；未修复则 failed 并交接部署项 |
| 一个频道成功、另一个失败 | 保留成功频道，先部署已满足门禁的成果，只补失败频道 | 分频道报告；顶层 healthy=false 时不声称双频道成功，不回滚成功频道 |
| 桌面镜像失败但网站健康 | 记录 DESKTOP_MIRROR_PENDING，保留 readiness/健康证据，后续只补拷贝 | 网站可以健康成功；明确镜像待补，不重做内容或触发 Pages |

## 已实现接口与剩余验收

2026-09-11 B/C 独立工作树代码交付更新：上述 B 状态与预检接口、C 发布/健康/七期接口均已有本地实现，组合版本以双方报告的集成提交和测试证据为准。仅拿 B 提交不能假定 C 的新发布命令已安装；不得据本节宣称生产流程已经运行。

- **B 状态/证据**：按频道只读查询、有效集合撤销与更新、冻结身份/截止校验、集中预检、就绪依赖哈希及受控发布状态更新已实现。旧状态安全读取；ready/published 标签与证据冲突会拒绝恢复而保留历史，不静默改写。init 不猜测或覆盖旧 issue。
- **事实与视觉**：程序只能验证证据结构和目标一致性，不能证明来源事实或观察记录真实性。真实统一渲染、原图检查、来源核验仍须执行；模板未自动接入新记录格式。旧 readiness 不自动升级，旧归档不重新制作。
- **冻结恢复**：迟到/损坏会明确阻断。已有截至 08:00 原始发现证据的人工核验恢复尚无自动入口，需保留实际恢复时间和可信原清单；无证据不得刷新动态发现面或回填冻结时间。
- **C 发布/健康**：同事务按实际字节恢复；健康按频道及 JSON/PNG/页面/目标提交验证，镜像问题独立报告。实际生产发布、线上 Pages、门户及历史交互仍需另行授权验收。
- **C 七期/时间**：selectPriorEditions/loadPriorBriefs 先选择最近七期再读取，正文全历史完整性仍由站点/构建验证负责。generateAt 仅可选 HH:mm 元数据，不是 cron 或准入开关；保留 11:00 硬门禁。
- **预算与耐久性**：25/2 策略未验证；文件锁仅本地互斥，临时文件/遗留锁须诊断，多文件状态与发布不是跨文件原子事务。断电/磁盘损坏和真实负载仍未验证。

## 本地性能与产物维护

- artifacts/operations 是接力和证明的一部分，自动清理不得删除当前日期或尚未完成运行的内容。维护不自动触发。
- 验证范围只按上表选择；`scripts/perf-check.ps1 -RunChecks` 仅为显式性能任务的基准工具，不能代替应有的 verify-build。
- `powershell -NoProfile -File scripts/local-maintenance.ps1 -MinimumAgeDays 14` 默认预览；只有明确授权并显式加 -Archive 才可复制、逐文件核验并移出。旧 operation 渲染归档另需 -ArchiveOperationRenders，运行状态 JSON 始终保留。
- 维护不得添加杀毒排除，不处理 .git、downloads、data/.pending 或 operations 内非渲染状态文件。
