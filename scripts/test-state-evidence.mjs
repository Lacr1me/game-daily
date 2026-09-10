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

await test('租约到期与错误持有人均拒绝写入', async () => {
  const root=await fixture('expired');
  await assert.rejects(ops.checkpointRunState(root,date,{runId:'other',now}),{code:'LEASE_MISMATCH'});
  await assert.rejects(ops.checkpointRunState(root,date,{runId:'0700',now:new Date('2026-09-01T10:00:00+08:00')}),{code:'LEASE_EXPIRED'});
});
await test('冻结后篡改内容和身份被识别', async () => {
  const root=await fixture('freeze-hash');
  const snapshot=await ops.freezeSteamDiscovery(root,{date,runId:'0700',now,sourceUrl:'https://store.steampowered.com/search/?specials=1',appIds:['100','101','102','103','104','105']});
  snapshot.appIds[0]='999';
  await writeFile(ops.operationPaths(root,date).steamDiscovery,JSON.stringify(snapshot));
  await assert.rejects(ops.inspectSteamDiscovery(root,date),{code:'FREEZE_CHANGED'});
  assert.equal((await ops.researchCompleteness(root,date,'game')).sections.deals.frozenDiscoveryComplete,false);
});
await test('旧布尔证据不能闭环；逐项证据更新与淘汰生效', async () => {
  const root=await fixture('evidence-update');
  await ops.appendResearchLedger(root,{...entry,evidenceComplete:true});
  assert.equal((await ops.researchCompleteness(root,date,'minsheng')).sections.domestic.evidenceComplete,false);
  const evidence={id:'one',decision:'accepted',url:'https://example.test/one',checkedAt:now.toISOString(),basis:'fixture',facts:{title:'one'}};
  await ops.appendResearchLedger(root,{...entry,candidateEvidence:[evidence]});
  assert.equal((await ops.researchCompleteness(root,date,'minsheng')).sections.domestic.evidenceComplete,true);
  await ops.appendResearchLedger(root,{...entry,candidateIds:[],candidateEvidence:[{...evidence,decision:'rejected',basis:'stale source'}]});
  assert.equal((await ops.researchCompleteness(root,date,'minsheng')).sections.domestic.candidateCount,0);
});
await test('相同 eventId 不允许改变历史内容', async () => {
  const root=await fixture('event-conflict');
  await ops.appendResearchLedger(root,{...entry,eventId:'fixed'});
  const before=await readFile(ops.operationPaths(root,date).ledger);
  await assert.rejects(ops.appendResearchLedger(root,{...entry,eventId:'fixed',candidateIds:['two']}),{code:'LEDGER_CONFLICT'});
  assert.deepEqual(await readFile(ops.operationPaths(root,date).ledger),before);
});
await test('退出原因区分配置预算和真实环境边界', async () => {
  const root=await fixture('budget');
  await assert.rejects(ops.checkpointRunState(root,date,{runId:'0700',runStatus:'complete',exitReason:'ENVIRONMENT_LIMIT',budget:{kind:'configured',deadlineAt:now.toISOString(),basis:'25 minutes'},now}),{code:'INVALID_CHECKPOINT'});
  const state=await ops.checkpointRunState(root,date,{runId:'0700',runStatus:'complete',exitReason:'CONFIGURED_BUDGET',budget:{kind:'configured',deadlineAt:now.toISOString(),basis:'unverified policy'},now});
  assert.equal(state.runs[0].exitReason,'CONFIGURED_BUDGET');
  assert.equal(state.channels.game.published,false);
});
await test('并发写入串行锁拒绝交错且保留成功记录', async () => {
  const root=await fixture('concurrent');
  const results=await Promise.allSettled([ops.appendResearchLedger(root,{...entry,eventId:'a'}),ops.appendResearchLedger(root,{...entry,eventId:'b',candidateIds:['two']})]);
  assert(results.some(item=>item.status==='fulfilled'));
  assert(results.filter(item=>item.status==='rejected').every(item=>item.reason.code==='STATE_BUSY'));
  assert.equal((await ops.readResearchLedger(root,date)).length,results.filter(item=>item.status==='fulfilled').length);
});

if (failures) process.exitCode = 1;
