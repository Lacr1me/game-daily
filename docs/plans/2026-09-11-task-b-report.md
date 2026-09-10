# B 状态与证据接口交接

接口版本：`state-evidence/v1`。本地代码、隔离测试、手册与 C 代码集成完成；生产验收未执行。工作树：`F:/Codex-App/日报设计/.worktrees/task-b-state-evidence`，分支 `codex/2026-09-11-task-b-state-evidence`，基线 `6b34e7a`。最终结果与边界见后半部分。

## C 可先使用的约定

- `queryRunState(root, date, { channel?, now? })`（daily-operations.mjs）：只读，返回 `{ apiVersion, date, checkedAt, lease, channels }`。频道包含兼容的 `complete/sections` 研究字段和 `research, stored, readiness, archive, online, publication, reasons`；不存在或损坏的状态以明确原因返回，不创建文件。
- `preflightChannel(root, { date, channel, candidate?, html?, png?, publicPng?, renderEvidence?, visualEvidence?, requireReady?, recovery?, candidateSha256?, pngSha256?, now? })`（daily-preflight.mjs）：只读，返回 `{ apiVersion, date, channel, ok, checkedAt, identity, gates, reasons, proof }`。`gates` 为命名门禁结果；失败原因 `{ code, message }`。不通过仍返回结构，CLI 退出 1。`assertChannelPreflight` 同参数，失败抛出带 `code=PRECHECK_FAILED, result` 的错误。
- `assertReadyProof(root, date, channel, options={})` 保留三参数调用；第四参数支持 `candidate` 和 `recovery=true`。恢复路径只允许该日期该频道正式正文，且必须与 readiness 的候选哈希相同。`requireReady=true` 预检不依赖状态标签，仍完整复核内容、研究、审计、七期归档、覆盖及渲染证明。
- `updatePublicationState(root, { date, channel, runId, transactionId, step, candidate?, candidateSha256, pngSha256, now? })`（daily-operations.mjs）：唯一受控发布状态更新。`step=prepared|content-written|index-written|embedded-written|complete`，与 C 事务日志分离，仅保存事务引用、哈希和进度。要求同日有效同 runId 租约；哈希必须匹配 readiness，完成时核验正式正文/索引/PNG。不负责 rename、索引或 embedded 写入。相同事务相同步骤幂等；倒退、换身份、冲突拒绝。恢复可使用新租约持有人继续同一事务。
- `assertRunLease(root, date, { runId?, now? })`：只读返回有效租约；显式 runId 必须匹配。旧调用方省略 runId 时使用磁盘唯一有效租约身份，绝不自动获取租约。新增 C 调用必须显式传 runId。

`now` 仅为直接 JS 隔离测试时钟依赖，CLI 不开放时钟覆盖。错误码包括 `LEASE_REQUIRED, LEASE_MISMATCH, LEASE_EXPIRED, STATE_CONFLICT, INVALID_CHECKPOINT, PROOF_MISSING, PROOF_CHANGED, PRECHECK_FAILED, PUBLICATION_CONFLICT`。旧状态缺新字段可查询；旧 readiness 缺完整门禁及视觉证据时返回失效，不能自动升格。`checkpoint` 不再允许任意字符串或绕过证据写 ready/published。

```js
const result = await preflightChannel(root, {
  date, channel, candidate: recoveredTarget, recovery: true,
  requireReady: true, candidateSha256, pngSha256
});
if (!result.ok) throw Object.assign(new Error('precheck failed'), { result });
await updatePublicationState(root, {
  date, channel, runId, transactionId, step: 'content-written',
  candidate: recoveredTarget, candidateSha256, pngSha256
});
```

## 验证和交付记录

2026-09-11 首版验证：`node scripts/test-state-evidence.mjs`（修复前 7 失败，修复后 7 通过）、`node scripts/test-daily-preflight.mjs`（20 项通过）、`node scripts/test-daily-operations.mjs`（通过）。所有夹具默认保留，未操作当天状态、生产租约、候选、部署、调度或外部日志；未修改 C 的文件。

## 可复用隔离夹具与证据形状

`scripts/state-evidence-fixtures.mjs` 的 `makeReadyFixture(base, channel, projectRoot=process.cwd())` 返回 `{root,date,channel,now,runId,candidate,html,png,publicPng,renderEvidence,visualEvidence,candidateSha256,pngSha256,brief}`，只在传入的独立 base 内建立 2026-09-10 模拟状态。然后调用 `createReadyProof(f.root, f)`。所有来源、渲染及视觉记录是明确标注的测试替身，不能移作生产验收。

`candidateEvidence` 数组元素为 `{id,decision:'accepted'|'rejected',url,checkedAt,basis,facts}`；接受项须有非空 facts，淘汰须有 basis；HTTPS URL 与同日 checkedAt 必须存在。最终正文 ID/URL/kind/name/title（Steam appId）须能匹配当前有效集合。`revokedCandidateIds` 配 reasons 可撤销；重复 eventId 幂等，复用 eventId 却改变内容拒绝。旧 accepted ID 仍可读数量，但无逐项证据不能完成；程序不代替事实来源核验。

渲染记录文件放当天 render 目录：`{date,channel,renderer:'render.mjs',scale:2,validate:true,checkedAt,candidateSha256,htmlSha256,pngSha256}`。视觉记录文件同目录：`{date,channel,method:'view_image',result:'pass',inspector,inspectedAt,pngSha256,findings:[]}`。只在实际统一渲染和原图检查后记录，不能由 PNG 尺寸推断。mark-ready 新增 `--render-evidence`、`--visual-evidence`、`--run-id`。readiness 还绑定本频道账本、审计/冻结、七期归档及两份记录的哈希；任一相关依赖变化使证明失效。

`queryRunState(...).channels[channel].publication` 是发布进度位置；update 返回 `{apiVersion,unchanged,publication,state}`。读取线上证据同时考虑默认双频道和分频道 health 文件，选最新对应频道记录，要求 15 分钟内 JSON/PNG 哈希及 page/deployment 有效。

兼容限制：旧写入调用省略 runId 时仍要求已有唯一有效租约；新的 C 调用显式 runId。旧 readiness 缺预检/视觉证明会失效，须补真实证据，不能通过迁移脚本自动认定就绪。`now` 仅供 JS 隔离测试，CLI 无时钟覆盖。冻结迟到或损坏一律保留、拒绝自动重扫/改时间；从原始证据重建冻结属于需另行核验的恢复动作。

## 最终交付与提交

本地代码、隔离测试、运行手册和 C 组合代码验收已完成；生产验收未执行。B 提交链：`ebcf6eb` 接口草案、`22cc9b2` 首版实现、`16aa571` 共享根夹具与 EOF 修正、`c13de80` 每次写入前再核验租约及退出原因。最终文档提交见本分支 Git 日志。标题时间为人工标签，实际提交时间以 Git 元数据为准。

维护文件：daily-operations.mjs、daily-run-state.mjs、check-research-completeness.mjs、test-daily-operations.mjs；新增 daily-preflight.mjs、state-evidence-fixtures.mjs、test-state-evidence.mjs、test-daily-preflight.mjs；文档为本报告及 docs/daily-runbook.md。未修改 C 文件、公共内容库、来源注册表、模板或视觉源码。

makeReadyFixture 现支持第四参数 `{root}`，可在同一隔离根建立两频道，检验另一频道成果保持不变。所有 B 测试默认保留夹具。

| 验证 | 实际结果 |
| --- | --- |
| node scripts/test-state-evidence.mjs | 13 项通过；最初 7 项曾在旧实现真实失败 |
| node scripts/test-daily-preflight.mjs | 双频道 20 项通过，含只读文件树哈希、缺证据拒绝、产物/记录变化、半发布、事务冲突、旧标签恢复 |
| node scripts/test-daily-operations.mjs | 既有来源/审计/内容/状态/模拟健康回归通过 |
| node scripts/test-site.mjs（B） | 基线失败：CRLF 导致“首页标题与 Logo 必须位于可精确对齐的独立网格行”断言；此文件归 C，B 未越界修改 |
| node scripts/build-site.mjs、verify-build.mjs（B） | 通过；执行前确认 dist 和源 data/.pending 均不存在，清理语句未删除既有对象 |
| C 组合分支 HEAD b9f3921 | 集成 B c13de80（对应 8c167f8），35 发布边界、共享根双向独立性、暂存后租约过期拒绝及新持有人恢复通过；站点/构建/13+20+既有测试通过 |
| git diff --check、git diff --cached --check | 最终通过；首版3处 EOF 空行已在16aa571修正 |

C 工作树 `F:/Codex-App/日报设计/.worktrees/task-c-publish-health`，分支 `codex/2026-09-11-task-c-integration`。上述组合结果已核对 C 实际执行报告，B/C 三个关键文件逐字比较（仅统一 CRLF/LF）一致；磁盘字节哈希因 Git 换行转换不同，未冒称完全相同。C 的本地真实 Edge 观察不代表生产线上验收，也不属于 B 真实原图检查。最后文档变更不改变已验证代码。

B 最终夹具：`C:/Users/Lacr1me/AppData/Local/Temp/springhues-b-evidence-UPNi1b`、`springhues-b-preflight-ydoLrp`、`daily-operations-0UpgPm`（后二者同一 Temp 目录）。C 最终组合夹具为同目录 `springhues-c-integration-vCLCey`。Node v24.19.0；来源/渲染/视觉均为明确标记的测试替身，不能作为真实事实或视觉证据。

## 预算抽样证据

只读主工作区 artifacts/operations/<date>-run-state.json 的 startedAt/finishedAt；未初始化、取租约或写回。55 轮最短1.29、最长33.03分钟，3轮超过23分钟，1轮超过25分钟。

| 日期 | 轮数 | 最短/最长分钟 | 超过23/25分钟 | SHA256 |
| --- | --- | --- | --- | --- |
| 2026-09-06 | 14 | 1.29 / 16.39 | 0 / 0 | A302AEEAA7EE8FD2371B292C076AF6A2AC9A178F06D7D3240ABC77005C650845 |
| 2026-09-08 | 14 | 3.11 / 23.42 | 1 / 0 | D2BF357B00D4EC9251E32CDFB08A2649D0C8A4FE5C8C155D680C5CF3A481F9E0 |
| 2026-09-09 | 13 | 2.39 / 33.03 | 1 / 1 | 10FCB35AF22EA1AAC059C15A196FF5C3CE474D955594BCBE166245C9E0347C57 |
| 2026-09-10 | 14 | 2.21 / 23.66 | 1 / 0 | 61FAC73C54812073D9A08116F0C6C360954D9734C2A65080CC948E48534A3EC2 |

样本没有退出原因、环境期限、阶段起止或收尾耗时，不能证明25/2足够；较短轮次可能正常就绪，也不能仅凭时长断言提前停工。结论：**未验证的预算策略**。建议在后续获准生产验收中观察至少7天，记录配置预算、环境期限及来源、接力边界、每阶段起止、退出原因、剩余缺口和收尾起止，计算分频道阶段及收尾P95后再决定调整。代码仅校验预算类别/原因，不以模拟时钟证明真实执行足够；租约 TTL 只控制互斥，未延长生产运行或修改调度。

## 恢复边界与未验证项

- 旧状态缺新字段安全查询；冲突返回原因并保留历史，不猜测补 issue。旧 readiness 缺预检/视觉记录须真实补核，不能自动升级或重做已发布历史。
- 模板渲染器尚未自动输出新记录（模板不属本任务维护范围）；操作者须在实际渲染/原图观察后据实落盘。程序不证明记录真实性或来源事实。
- 缺失/迟到/损坏冻结拒绝自动重扫、回填时间；基于既存08:00前发现证据的恢复仍须另行核验并记录真实恢复时间，没有自动恢复入口。
- 本地写锁/损坏租约/临时文件保留诊断；无跨主机互斥、跨文件原子性、断电或磁盘损坏保证。C 无日志旧半发布不自动接管。
- 未操作当天研究、候选、生产租约、真实发布、Pages/线上健康、真实原图或桌面镜像；按总任务书由统筹另行安排生产验收。

权限变化：无全局配置、自动化、云端变化，无推送、部署、付费或日志外发。仅为隔离在主仓库本机 .git/info/exclude 追加 /.worktrees/。主工作区民生 UI 及无关内容未由 B 修改。Windows 沙箱 helper 启动失败后通过环境批准的 exec 调用本地 apply_patch，未修改沙箱设置或用 Node/Python 绕过批量删除限制；所有测试夹具与构建保留。
