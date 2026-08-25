# 双频道日报运行手册

本手册是两个独立 Codex 计划任务的仓库入口。事实、来源与视觉规则仍以 `$artifact-template-daily-brief`、`$artifact-template-minecraft-daily-brief` 及其 `artifact-template.json`、`references/editorial-rules.md`、`references/layout-spec.md` 为准；网页源码是唯一视觉标准，候选 JSON 是唯一文字标准。

## 不可变约束

- 时区固定为 `Asia/Shanghai`。制作任务每天 08:30、09:30、10:30 分三次独立接力，发布与补跑任务每天 11:10、11:40 分两次独立执行；`publishAt` 固定为当天 11:00，11:00 前禁止调用发布脚本。
- 每次计划运行是新任务，不读取或延续旧聊天。当天续跑只读取仓库、`data/.pending/` 和 `artifacts/operations/` 中的结构化状态。
- 禁止 OpenAI Platform API、`OPENAI_API_KEY`、`api.openai.com` 和任何付费模型 API。只使用当前 Codex 任务自带网页检索。
- 不复制上一期，不复用旧 URL 冒充新内容；保留用户未提交和无关改动。
- 不得仅因某个站点一次不可用就结束。来源不可用只有在实际重试两次后才是账本终态，其他来源仍须继续。
- 电脑必须保持开机、网络可用且 ChatGPT/Codex 桌面应用持续运行。计划任务无法弥补关机、休眠或应用退出；恢复后下一次接力运行只从仓库状态续跑。
- 每次运行只推进到下一个可验证检查点，不在任务中空等下一个钟点。08:30未完成的研究由09:30续接，09:30未完成的由10:30续接；11:10发布失败由11:40按状态精确重试。

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

   11:10与11:40补跑使用 `--kind=recovery`，不得新建另一套当天状态。

5. 先运行 `node scripts/daily-run-state.mjs status --date=YYYY-MM-DD`。后续轮次只处理 `missing`、`incomplete`、未就绪或未发布的频道和栏目；已就绪/已发布频道禁止重做。

## 检索账本与审计

每完成一个来源站点或来源类别，立即记录，不得等任务末尾回忆补写：

`node scripts/daily-run-state.mjs record --date=YYYY-MM-DD --run-id=HHMM --channel=minsheng --section=domestic --source=新华网 --tier=primary --status=accepted --url=https://... --available=3 --rejected=1 --reason=重复1条 --candidates=id-1|id-2`

允许状态为：

- `started`：已开始但尚未完成，不能通过门禁。
- `accepted`：完成该来源核验并取得可用候选。
- `rejected`：完成核验但候选全部因时效、重复、权威性或字段缺失被淘汰。
- `exhausted`：完成核验但没有符合窗口的新候选。
- `unavailable`：实际访问失败；同一频道、栏目和来源至少记录两次真实失败才算终态。

标准来源 ID、别名和各栏目必查集合只取自 `config/daily-sources.json`。不得自行用“新华社／新华网”一类组合名称替代标准名称；脚本会兼容旧别名并写回“新华网”“中国科技网”等标准名称。

民生每次运行写独立审计快照：

- `artifacts/operations/YYYY-MM-DD-HHMM-source-audit.json`
- `artifacts/operations/YYYY-MM-DD-1110-source-audit.json`
- `artifacts/operations/YYYY-MM-DD-1140-source-audit.json`

然后运行 `node scripts/merge-source-audits.mjs --date=YYYY-MM-DD` 生成发布脚本使用的 `YYYY-MM-DD-source-audit.json`。后一次任务不得直接覆盖前一次快照。

在判断“证据不足”或调用任一发布脚本前，必须运行：

`node scripts/check-research-completeness.mjs --date=YYYY-MM-DD`

命令失败表示仍是“尚未搜完”，不得报告“素材不足”。发布脚本也会再次执行同一门禁。

## 制作、渲染与发布

- 08:30轮优先完成来源研究与候选池；09:30轮读取账本补缺并尽量生成候选；10:30轮完成剩余候选、统一渲染与冻结预检。各轮均可提前推进，但不得重做已完成阶段。
- 10:25—10:40：从候选池生成 `data/.pending/minsheng/YYYY-MM-DD.json` 和 `data/.pending/YYYY-MM-DD.json`。民生为 10/10/10/5；游戏为 2 features、10 news、10 packs、6 mods、6—24 deals、4 trends。
- 新游戏期次每个 pack 必须包含当天或前一天的 `heatEvidenceAt` 和可追溯的 `heatSignals`；整合包自身不要求当天发布。Mod 只有模板允许时可回退30天。
- 10:40—10:50：分别调用两个技能的统一 `render.mjs`，使用 `--scale 2 --validate true`，HTML与PNG必须来自同一候选JSON。工作版写入 `artifacts/operations/YYYY-MM-DD-render/`，公开PNG与桌面成品按模板路径复制。
- 10:50后冻结栏目，只修复校验错误。依次执行来源完整性、两个频道校验器、归档一致性、嵌入构建、站点测试、站点构建和构建验证。
- 通过全部预检后，必须为每个频道生成就绪证明。以下参数均使用实际绝对或仓库相对路径：

  `node scripts/daily-run-state.mjs mark-ready --date=YYYY-MM-DD --channel=minsheng --candidate=data/.pending/minsheng/YYYY-MM-DD.json --html=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-民生日报.html --png=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-民生日报.png --public-png=downloads/minsheng/YYYY-MM-DD.png`

  `node scripts/daily-run-state.mjs mark-ready --date=YYYY-MM-DD --channel=game --candidate=data/.pending/YYYY-MM-DD.json --html=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-游戏简报.html --png=artifacts/operations/YYYY-MM-DD-render/YYYY-MM-DD-游戏简报.png --public-png=downloads/game/YYYY-MM-DD.png`

  就绪证明记录候选、HTML和PNG哈希；发布脚本会重新计算并拒绝任何就绪后改动、缺失或非3840px的PNG。
- 11:00后两个频道独立调用 `publish-minsheng.mjs` 与 `publish-brief.mjs`。成功一个就保留一个，失败频道继续展示上一期。
- 发布后重建、测试、提交并推送 `main`，等待 Pages，再运行 `node scripts/check-daily-health.mjs --live=https://springhues.com --save`，将完整结果保存为当天 `health.json`。
- 公开 `downloads/` PNG、站点发布和线上健康是发送成功的硬门禁。桌面历史镜像仍须尝试且不得覆盖旧文件；若仅因无人值守权限导致桌面镜像失败，在操作记录中标记 `DESKTOP_MIRROR_PENDING`，不撤销已验证的网站发布，由11:40再次补拷贝。

## 11:10与11:40决策顺序

1. 读取健康检查的 `healthy`、`degraded`、`warnings`、`reasonCodes`、`transport` 和每频道 `content/png/deployment`。
2. 今日双频道全部健康：只记录结果并补做尚未完成的桌面镜像，不重做内容、不发布、不触发Pages。
3. 本地正式内容与PNG健康、仅线上部署失败：只处理部署，不重新生成内容。
4. 正式内容缺失但pending合法：继续渲染、复制PNG、校验和发布。
5. 账本显示研究未完成：只补 `missingSections`；沿用当天账本，不覆盖此前审计快照。11:40只处理11:10留下的明确失败项。
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

任何一项未满足都保留上一期有效内容，并在11:40精确重试；11:40后仍失败才通知人工，不得伪造成功。
