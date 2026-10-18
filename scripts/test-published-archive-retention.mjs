import assert from 'node:assert/strict';
import { mkdtemp, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as ops from './daily-operations.mjs';
import { preflightChannel } from './daily-preflight.mjs';
import { hash, makeReadyFixture, writeJson } from './state-evidence-fixtures.mjs';

const base = await mkdtemp(path.join(os.tmpdir(), 'springhues-published-retention-'));
console.log('Isolated synthetic fixtures retained: ' + base);
let checks = 0;
for (const channel of ['game', 'minsheng']) {
  const f = await makeReadyFixture(base, channel);
  const { root, date, now, runId } = f;
  const paths = ops.operationPaths(root, date);
  const target = ops.archiveContentPath(root, date, channel);
  const index = path.join(path.dirname(target), 'index.json');
  const manifestBefore = { timezone: 'Asia/Shanghai', publishAt: '11:00', editions: [] };
  for (let day = 9; day >= 2; day--) {
    const priorDate = '2026-09-0' + day;
    const brief = structuredClone(f.brief);
    brief.date = priorDate;
    brief.issue = day - 1;
    const sections = channel === 'game' ? Object.fromEntries(['features', 'news', 'packs', 'mods', 'trends'].map(key => [key, brief[key]])) : brief.sections;
    for (const [section, items] of Object.entries(sections)) {
      const changed = items.map((item, i) => typeof item === 'string' ? priorDate + ' ' + item : { ...item, title: priorDate + ' ' + (item.title || item.name || section), name: priorDate + ' ' + (item.name || item.title || section), url: `https://example.test/${priorDate}/${section}/${i}` });
      if (channel === 'game') brief[section] = changed;
      else brief.sections[section] = changed;
    }
    const file = path.relative(root, ops.archiveContentPath(root, priorDate, channel)).replaceAll('\\', '/');
    await writeJson(path.join(root, file), brief);
    await writeJson(ops.operationPaths(root, priorDate).readiness, { date: priorDate, channels: { [channel]: { issue: brief.issue, candidateSha256: hash(await readFile(path.join(root, file))) } } });
    manifestBefore.editions.push({ date: priorDate, issue: brief.issue, publishAt: priorDate + 'T11:00:00+08:00', file });
  }
  f.brief.issue = 9;
  await writeJson(f.candidate, f.brief);
  f.candidateSha256 = hash(await readFile(f.candidate));
  const state = JSON.parse(await readFile(paths.state, 'utf8'));
  state.channels[channel].issue = 9;
  await writeJson(paths.state, state);
  const renderEvidence = JSON.parse(await readFile(f.renderEvidence, 'utf8'));
  renderEvidence.candidateSha256 = f.candidateSha256;
  await writeJson(f.renderEvidence, renderEvidence);
  await writeJson(index, manifestBefore);
  await ops.createReadyProof(root, f);

  const publication = { date, channel, runId, transactionId: 'retention-fixture', candidateSha256: f.candidateSha256, pngSha256: f.pngSha256, now };
  await ops.updatePublicationState(root, { ...publication, step: 'prepared', candidate: f.candidate });
  await rename(f.candidate, target);
  await ops.updatePublicationState(root, { ...publication, step: 'content-written', candidate: target });
  const edition = { date, issue: 9, publishAt: date + 'T11:00:00+08:00', file: path.relative(root, target).replaceAll('\\', '/') };
  const manifestAfter = { ...manifestBefore, editions: [edition, ...manifestBefore.editions] };
  await writeJson(index, manifestAfter);
  await ops.updatePublicationState(root, { ...publication, step: 'index-written', candidate: target });
  await ops.updatePublicationState(root, { ...publication, step: 'complete', candidate: target });
  const journalFile = path.join(paths.directory, `${date}-${channel}-publish-transaction.json`);
  const journal = { schemaVersion: 1, id: publication.transactionId, step: 'complete', identity: { date, channel, candidateSha256: f.candidateSha256, pngSha256: f.pngSha256 }, manifestBefore, manifestAfter };
  await writeJson(journalFile, journal);
  const retained = { ...manifestAfter, editions: manifestAfter.editions.slice(0, 7) };
  await writeJson(index, retained);
  for (const old of manifestAfter.editions.slice(7)) await unlink(path.join(root, old.file));
  const verify = () => preflightChannel(root, { date, channel, candidate: target, recovery: true, requireReady: true, now });
  const accepted = await verify();
  assert.equal(accepted.ok, true, 'Completed publication must survive seven-edition pruning: ' + JSON.stringify(accepted.reasons));
  assert.equal((await ops.queryRunState(root, date, { channel, now })).channels[channel].archive.valid, true);
  assert.equal((await ops.reconcileRunState(root, date, { channel, runId, now })).ok, true);
  checks += 3;

  const priorFile = path.join(root, retained.editions[1].file);
  const prior = JSON.parse(await readFile(priorFile, 'utf8'));
  await writeJson(priorFile, { ...prior, headline: prior.headline + ' changed' });
  assert.equal((await verify()).gates.proofFreshness.ok, false, 'Changed retained body must fail');
  await writeJson(priorFile, prior);
  const changedIndex = structuredClone(retained);
  changedIndex.editions[1].headline = 'Changed metadata';
  await writeJson(index, changedIndex);
  assert.equal((await verify()).gates.proofFreshness.ok, false, 'Changed retained metadata must fail');
  await writeJson(index, { ...retained, editions: retained.editions.slice(0, 6) });
  assert.equal((await verify()).gates.proofFreshness.ok, false, 'Removing within the retention window must fail');
  await writeJson(index, retained);
  checks += 3;

  await writeJson(journalFile, { ...journal, step: 'index-written' });
  assert.equal((await verify()).gates.proofFreshness.ok, false, 'Incomplete transaction must fail');
  await writeJson(journalFile, { ...journal, id: 'different-transaction' });
  assert.equal((await verify()).gates.proofFreshness.ok, false, 'Transaction mismatch must fail');
  await writeJson(journalFile, journal);
  const oldReadyFile = ops.operationPaths(root, '2026-09-03').readiness;
  const oldReady = JSON.parse(await readFile(oldReadyFile, 'utf8'));
  await writeJson(oldReadyFile, { ...oldReady, channels: { [channel]: { issue: 2, candidateSha256: '0'.repeat(64) } } });
  assert.equal((await verify()).gates.proofFreshness.ok, false, 'Changed removed-body identity must fail');
  await writeJson(oldReadyFile, oldReady);
  assert.equal((await verify()).ok, true);
  checks += 4;
}
console.log(`Published retention: ${checks} checks passed; synthetic evidence is not production acceptance.`);
