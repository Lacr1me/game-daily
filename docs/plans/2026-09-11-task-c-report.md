# C 发布恢复与健康验证交接

工作树：`F:/Codex-App/日报设计/.worktrees/task-c-publish-health`。最终集成分支：`codex/2026-09-11-task-c-integration`；独立开发分支：`codex/2026-09-11-task-c-publish-health`；基线 `6b34e7a`。C 本地实现、独立测试、B 实际接口集成及适用验证已完成；生产验收未执行。

## 提交与变更清单

- C 实现：`c9da28a`（发布恢复、健康、七期与时间语义）；C 集成修正：`5712f51`（租约提交边界、日志损坏拒绝、共享根独立性和租约转交验收）。报告收口另为文档提交。
- 已集成 B 代码提交 `ebcf6eb`、`22cc9b2`、`16aa571`、`c13de80`；集成分支对应 `75fbbe7`、`65d2a78`、`ab2025d`、`8c167f8`。B 文档收口 `b14faf2` 已集成为 `39c6272`，包含 C 的发布恢复、健康、七期与时间语义手册建议。该提交只改手册和 B 报告，代码测试证据仍对应最终代码；B 文档由 B 独占维护。
- C 修改：`scripts/publish-brief.mjs`、`scripts/publish-minsheng.mjs`、`scripts/check-daily-health.mjs`、`scripts/health-lib.mjs`、`scripts/archive-consistency.mjs`、`scripts/test-site.mjs`。
- C 新增：`scripts/publish-channel.mjs`、`scripts/publish-transaction.mjs`、`scripts/health-browser-probe.mjs`、`scripts/test-publish-legacy-repro.mjs`、`scripts/test-publish-recovery.mjs`、`scripts/test-publish-integration.mjs`、`scripts/test-health-evidence.mjs`、`scripts/test-health-browser.mjs`、`scripts/test-archive-window.mjs`及本报告。

## 恢复协议

文档追加复核：已纳入 B 的 `dcea2c6`，修正手册表格中全局阶段与单频道 healthy 的两处旧语义；只涉及两行文档，不改变代码验收范围。

- `publish-brief.mjs`、`publish-minsheng.mjs` 进入共用 `publish-channel.mjs`，要求显式 `--run-id=...`。日期仍由北京时间计算，CLI 不开放时钟覆盖。每个文件写入前经 B 的只读完整预检和租约检查；生产 11:00 门禁保留。
- `publish-transaction.mjs` 负责文件事务，日志为 `artifacts/operations/YYYY-MM-DD-CHANNEL-publish-transaction.json`。绑定日期、频道、正文 SHA256、PNG SHA256、事务 ID、索引修改前后哈希及内容、已完成步骤。
- 顺序：持门禁写 prepared 日志 → B prepared → 正文 rename → 日志/B content-written → 索引暂存并 rename → 日志/B index-written → game 嵌入数据暂存并 rename → 日志/B embedded-written → B complete → 日志 complete。
- 每次单文件替换先写唯一 `.staged` 文件并 sync，再复核门禁/租约后 rename；预检结束也再次检查租约。这是可恢复的多文件协议，不是跨文件原子事务，也未作断电/文件系统损坏保证。中断后的暂存和日志保留供检查。无本协议日志的旧半发布不自动接管，保留正式正文并报冲突供诊断。
- 恢复以实际字节为准，匹配的正文/PNG复用；索引只接受已记录的修改前或修改后哈希。未知正式正文、不同输入、不同 PNG、非本事务索引修改均明确拒绝，保留证据。未完成日志不得清理。
- B 的 publication 状态可能比日志领先一步；适配层只读查询，跳过同事务已完成的较早步骤，身份不一致则拒绝。不另写 run-state，不回滚另一频道。

## 健康接口与证明边界（供 B 修订运行手册）

- `runDailyHealth` / CLI 新增 `channel` / `--channel=game|minsheng`；省略保留双频道汇总。`local`、`live`、`channels` 和顶层 `healthy` 保留，另给出 `localArchived`、`onlineVerified`、分频道 `healthy`、`scope`、`targetCommit`。
- `reachability` 仅 HTTP 可达；`content`、`png` 验证实际响应字节 SHA256 与本地一致；`page` 必须有真实浏览器观察；`deployment` 必须有新鲜 Pages API 证明及完整目标提交一致。缺证明时给原因，不能把 HTTP 200 记为部署证明。
- JS 入口可注入 `pageProbe` 和 `deploymentProof`；CLI 接受 `--target-commit=<40位SHA> --evidence=<JSON>`。证据 JSON 字段为 `deployment`、`pages.game/minsheng`、可选 `mirror`。证据由已授权的只读采集提供，CLI 不自动请求 GitHub 凭据或打开生产浏览器。
- 页面证明字段：`method: browser, checkedAt, url, displayedDate, selectedDate, downloadUrl`。Pages 证明字段：`source: github-pages-api, checkedAt, headSha, conclusion: success, siteUrl, evidenceUrl`；API URL 指向对应 Pages build。时间默认最多早于本轮 15 分钟、最多超前 60 秒。`health-browser-probe.mjs` 可用真实 browser page 采集目标期页面观察。
- `--save` 须持同日租约；单频道文件为 `YYYY-MM-DD-game-health.json` / `-minsheng-health.json`，双频道旧文件名不变，防止覆盖另一频道健康证明。
- 镜像 `failed/pending` 独立保留于 `mirror`，不改变网站健康。TLS 同域 HTTP 降级仍保留，但内容、页面及部署的完整门禁仍须通过。
- 单频道健康不等于双频道发送成功；本地浏览器/注入 fetch 证据不等于线上生产验收。门户实际展示、生产 Pages、线上历史交互仍按手册单独验收。

## 七期与时间语义

`selectPriorEditions` 按频道验证路径、排除目标日及未来、去重、日期排序后只选最近七期；`loadPriorBriefs` 才读正文。归档 CLI 和发布复用此入口；`test-site` 与 `verify-build` 独立保留全历史完整性校验。重复日期且元数据冲突时拒绝。

`generateAt` 只作可选有效 HH:mm 元数据校验，不再断言 09:30 为制作准入或 cron。保留北京时间 11:00 与未来期不得公开的测试。未修改正式索引和自动化。

## 验证结果（全部为本地隔离，已通过）

- `node scripts/test-publish-legacy-repro.mjs`：直接取基线 `6b34e7a` 两个发布脚本，在成功门禁替身下于正文 rename 后注入中断，确认索引为空且重跑报“草稿不存在”。这是旧版文件顺序故障复现，不是假称完整门禁已验证。
- `node scripts/test-publish-recovery.mjs`：35 个双频道写入/暂存/状态边界中断、恢复、重复恢复、正文/PNG/索引/损坏日志冲突通过；使用替身门禁，临时夹具保留。
- `node scripts/test-publish-integration.mjs`：接入上述已提交 B 的 `preflightChannel`、`assertRunLease`、`queryRunState`、`updatePublicationState`；35 个边界恢复与重复恢复通过；错误租约、11:00前、PNG改动被拒绝；同一根目录双向成功频道正文/PNG/索引/状态保持不变；暂存后租约过期时索引不提交，新租约持有人可接续同一事务。测试来源、渲染和视觉证据均是明确标注的合成夹具，不能用于生产。
- `node scripts/test-health-evidence.mjs`：限定频道、旧 JSON 200、错误 PNG、错误页面日期、错误提交、单频道失败和镜像失败通过。HTTP、浏览器、Pages 均为注入替身。
- `node scripts/test-archive-window.mjs`：七次读取、跨频道、乱序、不足七期、排除未来和重复项通过。
- `node scripts/test-health-browser.mjs`：真实 Edge 本地双频道目标期/历史期、日期选择器、未来期回退及下载 URL 通过；冻结浏览器时间，确认 10:59:59 不公开目标期、11:00:00 可打开目标期。所有外部请求被阻断。观察记录 `output/playwright/task-c-browser-evidence.json`。运行时设置 `PLAYWRIGHT_MODULE=C:/Users/Lacr1me/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`，使用现有 Edge，不安装依赖。
- `node scripts/test-site.mjs`：基线失败是 CRLF 导致 CSS 源码断言误报；改为空白兼容匹配后通过，未改页面源码。

- `node scripts/test-daily-operations.mjs`：集成后的既有来源/状态/健康检查通过；默认保留隔离目录，无批量清理。
- `node scripts/test-state-evidence.mjs`：B 最新补丁的 13 项状态回归通过。
- `node scripts/test-daily-preflight.mjs`：20 项双频道集中预检/状态恢复通过。
- `node scripts/build-site.mjs`、`node scripts/verify-build.mjs`：通过；执行前核对精确工作树，确认 `dist` 及源 `data/.pending` 均不存在，所以两个清理调用没有删除既有对象。构建仅在 C 工作树生成，未改正式索引/正文。后续租约和测试补丁不在静态构建复制范围，构建证据仍适用。
- `git diff --check`、提交前 `git diff --cached --check`：通过。最初 CRLF 导致的基线断言失败已单独定位修复，未修改 UI 源码。

最终集成夹具：`C:/Users/Lacr1me/AppData/Local/Temp/springhues-c-integration-vCLCey`；替身恢复夹具：`C:/Users/Lacr1me/AppData/Local/Temp/springhues-c-recovery-fLrt7M`；B 集中预检夹具：`C:/Users/Lacr1me/AppData/Local/Temp/springhues-b-preflight-nhbbs1`。本地输出和夹具保留，不提交生成的网页/截图证据为生产成品。

## 未验证项与交付边界

未访问生产站、未获取真实 Pages 提交证明、未验收线上历史交互或桌面镜像；未进行真实发布/断电恢复。后续由统筹任务安排生产只读或真实运行验收，并取得相应新鲜证据。C 的本地实现与 B 代码集成已完成，上述生产项按总任务书保留。

未推送、未部署、未运行生产候选/租约/定时任务、未外发日志；权限边界未扩大。原工作区的民生 UI 和全部无关未提交改动保留；B 文件仅引入其已交付提交，C 没有独立编辑 B 状态代码或运行手册。
