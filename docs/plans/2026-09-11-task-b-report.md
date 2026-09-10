# B 状态与证据接口交接

接口版本：`state-evidence/v1`。当前阶段：首版接口已实现，7 个缺陷回归、双频道 20 项预检/恢复检查和既有运行测试通过；手册、额外一致性检查及 C 集成仍在推进。工作树：`F:/Codex-App/日报设计/.worktrees/task-b-state-evidence`，分支 `codex/2026-09-11-task-b-state-evidence`，基线 `6b34e7a`。草案提交 `ebcf6eb` 的标题时间为人工命名标签，真实提交时间以 Git 元数据为准。

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
