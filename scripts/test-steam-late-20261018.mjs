import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import * as ops from './daily-operations.mjs';
const base=await mkdtemp(path.join(os.tmpdir(),'steam-late-20261018-'));
console.log('Retained isolated fixtures: '+base);
const appIds=['100001','100002','100003','100004','100005','100006'];
const sourceUrl='https://store.steampowered.com/search/?specials=1&cc=cn&l=schinese';
async function fixture(date,suffix,approvalText='补发，所有的都对齐'){
 const root=path.join(base,suffix),runId='fixture',now=new Date(date+'T16:31:00+08:00');
 await ops.acquireRunLease(root,{date,runId,now});await ops.initializeRunState(root,{date,runId,now});
 const file=path.join(root,'artifacts','operations',date+'-steam-late-authorization.json');
 await writeFile(file,JSON.stringify({schemaVersion:1,date,runId,scope:'steam-late-discovery-once',approvalText,approvalReference:'synthetic isolated regression fixture; never production authority',approvalRecordedAt:date+'T16:00:00+08:00',collectedAt:date+'T16:30:00+08:00',sourceUrl,appIds,extraAppIds:[]}));
 return {root,date,runId,now,file};
}
const allowed=await fixture('2026-10-18','allowed');
const frozen=await ops.freezeSteamDiscovery(allowed.root,{...allowed,sourceUrl,appIds,lateAuthorizationFile:allowed.file});
assert.equal(frozen.frozenAt,allowed.now.toISOString());assert.equal(frozen.frozen,true);assert.ok(frozen.lateAuthorization?.sha256);
assert.deepEqual((await ops.inspectSteamDiscovery(allowed.root,allowed.date)).appIds,appIds);
const noProof=await fixture('2026-10-18','no-proof');
await assert.rejects(ops.freezeSteamDiscovery(noProof.root,{...noProof,sourceUrl,appIds}),{code:'FREEZE_LATE'});
const wrongText=await fixture('2026-10-18','wrong-text','generic repair');
await assert.rejects(ops.freezeSteamDiscovery(wrongText.root,{...wrongText,sourceUrl,appIds,lateAuthorizationFile:wrongText.file}),{code:'FREEZE_AUTH_INVALID'});
const future=await fixture('2026-10-19','future-date');
await assert.rejects(ops.freezeSteamDiscovery(future.root,{...future,sourceUrl,appIds,lateAuthorizationFile:future.file}),{code:'FREEZE_AUTH_INVALID'});
console.log('PASS18th authorized actual-time freeze; proof/text required;19th remains denied');
