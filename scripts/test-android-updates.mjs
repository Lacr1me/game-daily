import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { androidDownloadName, androidDownloadUrl, verifyAndroidDownload } from './android-download.mjs';

const relativeManifest = 'updates/simple-download-android/latest.json';
const exactFields = ['schemaVersion','appId','channel','version','versionCode','downloadUrl','releasePageUrl','size','sha256','publishedAtUtc','notes'];

export function validateAndroidUpdate(value, works) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'manifest must be an object');
  assert.deepEqual(Object.keys(value).sort(), [...exactFields].sort(), 'Android manifest schema fields');
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.appId, 'simple-download-android');
  assert.equal(value.channel, 'stable');
  assert.match(value.version, /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.([0-9]{2}|0|[1-9][0-9]{0,5})$/);
  assert.ok(Number.isSafeInteger(value.versionCode) && value.versionCode > 0 && value.versionCode <= 2147483647, 'Android versionCode');
  assert.ok(Number.isSafeInteger(value.size) && value.size >= 2 && value.size <= 268435456, 'APK size must match the client 256 MiB limit');
  assert.match(value.sha256, /^[a-f0-9]{64}$/);
  assert.ok(typeof value.notes === 'string' && value.notes.length <= 8000, 'bounded release notes');
  assert.match(value.publishedAtUtc, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/);
  const published = Date.parse(value.publishedAtUtc);
  assert.ok(Number.isFinite(published) && published >= Date.parse('2020-01-01T00:00:00Z') && published <= Date.now() + 300000, 'release must already be published');
  assert.equal(new Date(published).toISOString().slice(0, 19), value.publishedAtUtc.slice(0, 19), 'valid calendar date');
  const tag = `simple-download-android-v${value.version}`;
  const base = 'https://github.com/Lacr1me/springhues-releases/releases/';
  assert.equal(value.downloadUrl, `${base}download/${tag}/SimpleDownload-${value.version}-Android.apk`, 'exact public APK asset URL');
  assert.equal(value.releasePageUrl, `${base}tag/${tag}`, 'matching immutable release page');
  const work = works.works.find(item => item.slug === 'simple-download-android');
  assert.ok(work, 'Android work entry required');
  assert.equal(work.version, value.version, 'website and updater versions must agree');
  assert.ok(work.links.some(link => link.kind === 'download' && [value.downloadUrl, androidDownloadUrl(value.version)].includes(link.href)), 'website APK must use the matching release or verified official copy');
  assert.ok(work.links.some(link => link.href === value.releasePageUrl), 'website and updater release page must agree');
  return value;
}

export async function verifyAndroidUpdates(root, { sourceRoot } = {}) {
  const text = await readFile(path.join(root, relativeManifest), 'utf8');
  assert.ok(Buffer.byteLength(text) <= 65536, 'bounded Android update manifest');
  const result = validateAndroidUpdate(JSON.parse(text), JSON.parse(await readFile(path.join(root, 'site/works.json'), 'utf8')));
  if (sourceRoot) {
    assert.equal(text, await readFile(path.join(sourceRoot, relativeManifest), 'utf8'), 'built Android manifest differs from source');
    const works = JSON.parse(await readFile(path.join(root, 'site/works.json'), 'utf8'));
    const work = works.works.find(item => item.slug === 'simple-download-android');
    if (work.links.some(link => link.kind === 'download' && link.href === androidDownloadUrl(result.version))) {
      await verifyAndroidDownload(root, result);
    }
  }
  return { published: true, version: result.version, versionCode: result.versionCode, size: result.size };
}

async function selfTest() {
  const value = { schemaVersion:1,appId:'simple-download-android',channel:'stable',version:'2.3.5',versionCode:51,size:8,sha256:'1'.repeat(64),publishedAtUtc:'2026-10-20T15:23:49Z',notes:'Controlled fixture only',downloadUrl:'https://github.com/Lacr1me/springhues-releases/releases/download/simple-download-android-v2.3.5/SimpleDownload-2.3.5-Android.apk',releasePageUrl:'https://github.com/Lacr1me/springhues-releases/releases/tag/simple-download-android-v2.3.5' };
  const works = { works:[{slug:'simple-download-android',version:value.version,links:[{kind:'download',href:value.downloadUrl},{kind:'visit',href:value.releasePageUrl}]}] };
  validateAndroidUpdate(value, works);
  let checks = 1;
  const officialWorks = structuredClone(works);
  officialWorks.works[0].links[0].href = androidDownloadUrl(value.version);
  validateAndroidUpdate(value, officialWorks); checks++;
  for (const invalidHref of [androidDownloadUrl('2.3.4'), androidDownloadUrl(value.version).replace('springhues.com', 'example.com')]) {
    const wrongWorks = structuredClone(officialWorks);
    wrongWorks.works[0].links[0].href = invalidHref;
    assert.throws(() => validateAndroidUpdate(value, wrongWorks)); checks++;
  }
  // Android now uses a two-digit patch, while published one-digit versions remain valid.
  for (const version of ['2.3.00', '2.3.01', '2.3.50', '2.3.51', '2.3.001', '02.3.51', '2.03.51']) {
    const fixture = {
      ...value, version,
      downloadUrl: value.downloadUrl.replaceAll(value.version, version),
      releasePageUrl: value.releasePageUrl.replaceAll(value.version, version)
    };
    const fixtureWorks = { works: [{
      ...works.works[0], version,
      links: [{kind:'download',href:fixture.downloadUrl},{kind:'visit',href:fixture.releasePageUrl}]
    }] };
    if (['2.3.001', '02.3.51', '2.03.51'].includes(version)) {
      assert.throws(() => validateAndroidUpdate(fixture, fixtureWorks), /regular expression/);
    } else {
      validateAndroidUpdate(fixture, fixtureWorks);
    }
    checks++;
  }
  for (const mutation of [
    {schemaVersion:2}, {appId:'simple-download-windows'}, {channel:'beta'}, {version:'2.3.5-beta'},
    {versionCode:0}, {versionCode:51.5}, {versionCode:2147483648}, {versionCode:'51'},
    {size:0}, {size:268435457}, {size:8.5}, {sha256:'bad'}, {sha256:'A'.repeat(64)},
    {downloadUrl:value.downloadUrl.replace('Lacr1me','someone')}, {downloadUrl:value.downloadUrl+'?download=1'},
    {downloadUrl:value.downloadUrl.replace('2.3.5-Android.apk','2.3.4-Android.apk')},
    {downloadUrl:value.downloadUrl.replace('https:','http:')}, {releasePageUrl:value.releasePageUrl+'-other'},
    {publishedAtUtc:'bad'}, {publishedAtUtc:'2026-02-30T00:00:00Z'},
    {publishedAtUtc:'2099-01-01T00:00:00Z'}, {notes:'x'.repeat(8001)}, {unexpected:true}
  ]) { assert.throws(() => validateAndroidUpdate({...value,...mutation}, works)); checks++; }
  const missingDigest = {...value}; delete missingDigest.sha256;
  assert.throws(() => validateAndroidUpdate(missingDigest, works)); checks++;
  for (const changedWorks of [
    {works:[]}, {works:[{...works.works[0],version:'2.3.4'}]},
    {works:[{...works.works[0],links:works.works[0].links.slice(1)}]},
    {works:[{...works.works[0],links:works.works[0].links.slice(0,1)}]}
  ]) { assert.throws(() => validateAndroidUpdate(value, changedWorks)); checks++; }

  // Only touch this uniquely created fixture; the real build is checked by verify-build.
  const directory = await mkdtemp(path.join(tmpdir(), 'simple-download-android-update-'));
  try {
    for (const name of ['source','built']) {
      const root = path.join(directory, name);
      await mkdir(path.join(root, path.dirname(relativeManifest)), {recursive:true});
      await mkdir(path.join(root, 'site'), {recursive:true});
      await writeFile(path.join(root, relativeManifest), JSON.stringify(value));
      await writeFile(path.join(root, 'site/works.json'), JSON.stringify(works));
    }
    const built = path.join(directory, 'built');
    const sourceRoot = path.join(directory, 'source');
    await verifyAndroidUpdates(built, {sourceRoot}); checks++;
    await writeFile(path.join(built, relativeManifest), JSON.stringify({...value,size:9}));
    await assert.rejects(() => verifyAndroidUpdates(built, {sourceRoot}), /differs from source/); checks++;
    await writeFile(path.join(built, relativeManifest), JSON.stringify({...value,notes:'x'.repeat(65536)}));
    await assert.rejects(() => verifyAndroidUpdates(built, {sourceRoot}), /bounded Android update manifest/); checks++;
    await rm(path.join(built, relativeManifest));
    await assert.rejects(() => verifyAndroidUpdates(built, {sourceRoot}), {code:'ENOENT'}); checks++;
    // A website mirror is accepted only when its built bytes match the updater's release.
    const apk = Buffer.from('APK-test');
    const mirroredValue = {...value, sha256:createHash('sha256').update(apk).digest('hex')};
    for (const root of [sourceRoot, built]) {
      await writeFile(path.join(root, relativeManifest), JSON.stringify(mirroredValue));
      await writeFile(path.join(root, 'site/works.json'), JSON.stringify(officialWorks));
    }
    await assert.rejects(() => verifyAndroidUpdates(built, {sourceRoot})); checks++;
    const apkPath = path.join(built, 'downloads/software', androidDownloadName(value.version));
    await mkdir(path.dirname(apkPath), {recursive:true});
    await writeFile(apkPath, apk);
    await verifyAndroidUpdates(built, {sourceRoot}); checks++;
    await writeFile(apkPath, Buffer.from('bad-file'));
    await assert.rejects(() => verifyAndroidUpdates(built, {sourceRoot})); checks++;
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('simple-download-android-update-'));
    await rm(directory, {recursive:true,force:true});
  }
  return checks;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checks = await selfTest();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify({checks,...await verifyAndroidUpdates(root)}));
}
