# C 发布恢复与健康验证交接

工作树：`F:/Codex-App/日报设计/.worktrees/task-c-publish-health`。分支：`codex/2026-09-11-task-c-publish-health`，基线 `6b34e7a`。当前为开发记录，尚未取得 B 提交完成集成，不代表生产验收。

## 恢复协议

- `publish-brief.mjs`、`publish-minsheng.mjs` 进入共用 `publish-channel.mjs`，要求显式 `--run-id=...`。日期仍由北京时间计算，CLI 不开放时钟覆盖。每个文件写入前经 B 的只读完整预检和租约检查；生产 11:00 门禁保留。
- `publish-transaction.mjs` 负责文件事务，日志为 `artifacts/operations/YYYY-MM-DD-CHANNEL-publish-transaction.json`。绑定日期、频道、正文 SHA256、PNG SHA256、事务 ID、索引修改前后哈希及内容、已完成步骤。
- 顺序：持门禁写 prepared 日志 → B prepared → 正文 rename → 日志/B content-written → 索引暂存并 rename → 日志/B index-written → game 嵌入数据暂存并 rename → 日志/B embedded-written → B complete → 日志 complete。
- 每次单文件替换先写唯一 `.staged` 文件并 sync，再 rename；这是可恢复的多文件协议，不是跨文件原子事务，也未作断电/文件系统损坏保证。中断后的暂存和日志保留供检查。
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

## 当前验证

- `node scripts/test-publish-recovery.mjs`：两频道写入/暂存/状态边界中断、恢复、重复恢复、输入冲突通过；使用替身门禁，临时夹具保留。
- `node scripts/test-health-evidence.mjs`：限定频道、旧 JSON 200、错误 PNG、错误页面日期、错误提交、单频道失败和镜像失败通过。HTTP、浏览器、Pages 均为注入替身。
- `node scripts/test-archive-window.mjs`：七次读取、跨频道、乱序、不足七期、排除未来和重复项通过。
- `node scripts/test-health-browser.mjs`：真实 Edge 本地双频道目标期/历史期、日期选择器、未来期回退及下载 URL 通过；所有外部请求被阻断。观察记录 `output/playwright/task-c-browser-evidence.json`。
- `node scripts/test-site.mjs`：基线失败是 CRLF 导致 CSS 源码断言误报；改为空白兼容匹配后通过，未改页面源码。

## 待完成

B 实际提交集成、真实完整门禁夹具的发布中断测试、集成 test-daily-operations、构建与 verify-build、git diff --check、提交编号及最终清单将在收口更新。未推送、未部署、未运行生产候选/租约/定时任务、未外发日志；权限边界未扩大。
