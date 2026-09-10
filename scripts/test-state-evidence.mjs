import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as ops from './daily-operations.mjs';

const base = await mkdtemp(path.join(os.tmpdir(), 'springhues-b-evidence-'));
console.log(`保留隔离夹具：${base}`);
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
}
const date = '2026-09-01';
const now = new Date('2026-09-01T07:00:00+08:00');
async function fixture(name) {
  const root = path.join(base, name);
  await ops.acquireRunLease(root, { date, runId: '0700', now });
  await ops.initializeRunState(root, { date, runId: '0700', now });
  return root;
}
const entry = { date, runId: '0700', channel: 'minsheng', section: 'domestic', sourceId: 'xinhua', status: 'accepted', candidateIds: ['one'], availableCount: 1, now };
await test('撤销 accepted 后当前候选减少且重复撤销幂等', async () => {
  const root = await fixture('revoke');
  await ops.appendResearchLedger(root, entry);
  await ops.appendResearchLedger(root, { ...entry, candidateIds: [], availableCount: 0, revokedCandidateIds: ['one'], reasons: ['duplicate'] });
  await ops.appendResearchLedger(root, { ...entry, candidateIds: [], availableCount: 0, revokedCandidateIds: ['one'], reasons: ['duplicate'] });
  assert.equal((await ops.researchCompleteness(root, date, 'minsheng')).sections.domestic.candidateCount, 0);
});
await test('相同更新不追加重复账本', async () => {
  const root = await fixture('idempotence');
  await ops.appendResearchLedger(root, entry);
  await ops.appendResearchLedger(root, entry);
  assert.equal((await ops.readResearchLedger(root, date)).length, 1);
});
await test('无租约不得初始化共享状态', async () => {
  await assert.rejects(ops.initializeRunState(path.join(base, 'no-lease'), { date, runId: '0700', now }), { code: 'LEASE_REQUIRED' });
});
await test('checkpoint 拒绝未知枚举', async () => {
  const root = await fixture('checkpoint');
  await assert.rejects(ops.checkpointRunState(root, date, { runId: '0700', stage: 'whatever', now }), { code: 'INVALID_CHECKPOINT' });
});
await test('迟于八点创建冻结必须失败', async () => {
  const root = await fixture('freeze-late');
  await ops.acquireRunLease(root, { date, runId: '0700', now: new Date('2026-09-01T09:00:00+08:00') });
  await assert.rejects(ops.freezeSteamDiscovery(root, { date, runId: '0700', sourceUrl: 'https://store.steampowered.com/search/?specials=1', appIds: ['100','101','102','103','104','105'], now: new Date('2026-09-01T09:00:00+08:00') }));
});
await test('冻结文件存在但日期错误不算完成', async () => {
  const root = await fixture('freeze-corrupt');
  await writeFile(ops.operationPaths(root, date).steamDiscovery, JSON.stringify({ date: 'wrong', frozen: true }));
  assert.equal((await ops.researchCompleteness(root, date, 'game')).sections.deals.frozenDiscoveryComplete, false);
});
await test('查询旧状态不写文件且给出证据缺失', async () => {
  const root = await fixture('query');
  const statePath = ops.operationPaths(root, date).state;
  await writeFile(statePath, JSON.stringify({ date, channels: { game: { status: 'ready' } } }));
  const before = await readFile(statePath);
  const result = await ops.queryRunState(root, date, { channel: 'game', now });
  assert.equal(result.channels.game.readiness.valid, false);
  assert.deepEqual(Object.keys(result.channels), ['game']);
  assert.deepEqual(await readFile(statePath), before);
});
if (failures) process.exitCode = 1;
