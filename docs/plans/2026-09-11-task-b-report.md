# B 状态与证据接口交接

接口版本：`state-evidence/v1`。当前阶段：接口约定，尚未实现；实现提交及测试结果完成后补充。工作树：`F:/Codex-App/日报设计/.worktrees/task-b-state-evidence`，分支 `codex/2026-09-11-task-b-state-evidence`，基线 `6b34e7a`。

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

待实现。未操作当天状态、生产租约、候选、部署、调度或外部日志；未修改 C 的文件。
