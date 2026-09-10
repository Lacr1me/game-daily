import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as ops from './daily-operations.mjs';
import { makeReadyFixture } from './state-evidence-fixtures.mjs';
import { publishChannel } from './publish-channel.mjs';

const base=await mkdtemp(path.join(os.tmpdir(),'springhues-c-integration-'));
console.log(`Integration fixtures retained: ${base}`);
const boundaries=['journal:prepared:staged','journal:prepared','state:publishing','body:written','journal:body:staged','journal:body','state:body','index:staged','index:written','journal:index:staged','journal:index','state:index','embedded:staged','embedded:written','journal:embedded:staged','journal:embedded','state:embedded','state:published','journal:complete:staged','journal:complete'];
let passed=0;
for(const channel of ['game','minsheng']) {
  for(const boundary of boundaries.filter(item=>channel==='game'||!item.includes('embedded'))) {
    const f=await makeReadyFixture(path.join(base,boundary.replaceAll(':','-')),channel);
    await ops.createReadyProof(f.root,f);
    const stateFile=ops.operationPaths(f.root,f.date).state;
    const other=channel==='game'?'minsheng':'game';
    const otherBefore=JSON.parse(await readFile(stateFile)).channels[other];
    await assert.rejects(publishChannel({...f,afterBoundary:async step=>{if(step===boundary)throw new Error('INJECTED');}}),/INJECTED/);
    const recovered=await publishChannel(f);
    assert.equal(recovered.status,'complete');
    assert.equal((await publishChannel(f)).status,'complete');
    const state=JSON.parse(await readFile(stateFile));
    assert.equal(state.channels[channel].published,true);
    assert.equal(state.channels[channel].publication.step,'complete');
    assert.deepEqual(state.channels[other],otherBefore);
    const view=await ops.queryRunState(f.root,f.date,{channel,now:f.now});
    assert.equal(view.channels[channel].archive.valid,true);
    assert.equal(view.channels[channel].online.valid,false);
    const body=await readFile(ops.archiveContentPath(f.root,f.date,channel));
    await assert.rejects(publishChannel({...f,runId:'intruder'}),{code:'LEASE_MISMATCH'});
    await assert.rejects(publishChannel({...f,now:new Date(f.date+'T10:59:59+08:00')}));
    await writeFile(f.publicPng,Buffer.from('changed'));
    await assert.rejects(publishChannel(f),/CONFLICT/);
    assert.deepEqual(await readFile(ops.archiveContentPath(f.root,f.date,channel)),body);
    passed++;
  }
}
console.log(`Actual B preflight/state + C publication: ${passed} interrupted boundaries recovered idempotently; wrong lease/time/PNG rejected; other channel retained. Synthetic source/render/visual fixtures only.`);
