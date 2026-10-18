import assert from 'node:assert/strict';
import { access, readFile, mkdir, writeFile, mkdtemp, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const relativeManifest = 'updates/simple-download-windows/latest.json';
const exactFields = ['schemaVersion','appId','channel','platform','architecture','version','releaseId','releaseCreatedAtUtc','publishedAtUtc','notes','installerUrl','fileName','size','sha256','releasePageUrl'];
export function validateSoftwareUpdate(value, works) {
  assert.deepEqual(Object.keys(value).sort(), [...exactFields].sort(), 'manifest schema fields');
  assert.equal(value.schemaVersion, 1);
  for (const [key, expected] of Object.entries({ appId:'simple-download-windows',channel:'stable',platform:'windows',architecture:'x64',fileName:'简单下载.exe' })) assert.equal(value[key], expected, key);
  assert.match(value.version, /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/);
  assert.match(value.releaseId, /^[A-Za-z0-9][A-Za-z0-9._-]{7,95}$/);
  for (const key of ['releaseCreatedAtUtc','publishedAtUtc']) { assert.match(value[key], /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/); assert.ok(Number.isFinite(Date.parse(value[key]))); }
  assert.ok(Date.parse(value.releaseCreatedAtUtc) >= Date.parse('2020-01-01T00:00:00Z'));
  assert.ok(Date.parse(value.publishedAtUtc) >= Date.parse(value.releaseCreatedAtUtc));
  assert.ok(Date.parse(value.publishedAtUtc) <= Date.now() + 300000);
  assert.ok(typeof value.notes === 'string' && value.notes.length <= 8000);
  assert.ok(Number.isSafeInteger(value.size) && value.size >= 2 && value.size <= 2147483648);
  assert.match(value.sha256, /^[a-f0-9]{64}$/);
  const tag = `simple-download-windows-v${value.version}-${value.releaseId}`;
  const base = 'https://github.com/Lacr1me/springhues-releases/releases/';
  const installer = new URL(value.installerUrl);
  assert.equal(installer.protocol, 'https:'); assert.equal(installer.username, ''); assert.equal(installer.password, ''); assert.equal(installer.port, ''); assert.equal(installer.search, ''); assert.equal(installer.hash, '');
  assert.ok(value.installerUrl.startsWith(`${base}download/${tag}/`));
  assert.match(value.installerUrl.slice(`${base}download/${tag}/`.length), /^[A-Za-z0-9._-]+\.exe$/);
  assert.equal(value.releasePageUrl, `${base}tag/${tag}`);
  const work = works.works.find(item => item.slug === 'simple-download-windows');
  assert.ok(work, 'Windows work entry required'); assert.equal(work.version, value.version);
  assert.ok(work.links.some(link => link.kind === 'download' && link.href === value.installerUrl), 'download button must match immutable manifest package');
  assert.ok(work.links.some(link => link.href === value.releasePageUrl), 'release page must match');
  return value;
}
export async function verifySoftwareUpdates(root, { requireManifest = false, sourceRoot } = {}) {
  const filename = path.join(root, relativeManifest);
  const exists = await access(filename).then(() => true, () => false);
  if (!exists) {
    assert.ok(!requireManifest, 'published update manifest missing');
    if (sourceRoot) assert.equal(await access(path.join(sourceRoot, relativeManifest)).then(() => true, () => false), false, 'source update manifest omitted from build');
    return { published: false };
  }
  const text = await readFile(filename, 'utf8'); assert.ok(Buffer.byteLength(text) <= 65536);
  const result = validateSoftwareUpdate(JSON.parse(text), JSON.parse(await readFile(path.join(root, 'site/works.json'), 'utf8')));
  if (sourceRoot) assert.equal(text, await readFile(path.join(sourceRoot, relativeManifest), 'utf8'), 'built manifest differs from source');
  return { published: true, releaseId: result.releaseId };
}
async function selfTest() {
  const value = { schemaVersion:1,appId:'simple-download-windows',channel:'stable',platform:'windows',architecture:'x64',version:'0.2.1',releaseId:'fixture-0001',releaseCreatedAtUtc:'2026-10-17T00:00:00Z',publishedAtUtc:'2026-10-17T01:00:00Z',notes:'Controlled fixture only',fileName:'简单下载.exe',size:8,sha256:'1'.repeat(64),installerUrl:'https://github.com/Lacr1me/springhues-releases/releases/download/simple-download-windows-v0.2.1-fixture-0001/SimpleDownload-0.2.1-Windows-Setup.exe',releasePageUrl:'https://github.com/Lacr1me/springhues-releases/releases/tag/simple-download-windows-v0.2.1-fixture-0001' };
  const works = { works:[{slug:'simple-download-windows',version:'0.2.1',links:[{kind:'download',href:value.installerUrl},{kind:'source',href:value.releasePageUrl}]}] };
  validateSoftwareUpdate(value, works);
  let checks = 1;
  for (const mutation of [{platform:'android'},{architecture:'arm64'},{schemaVersion:2},{version:'0.2.1-beta'},{releaseId:'../invalid'},{size:0},{sha256:'bad'},{fileName:'run.cmd'},{installerUrl:value.installerUrl.replace('Lacr1me','someone')},{releasePageUrl:value.releasePageUrl+'-other'},{publishedAtUtc:'bad'},{unexpected:true}]) { assert.throws(() => validateSoftwareUpdate({...value,...mutation}, works)); checks++; }
  assert.throws(() => validateSoftwareUpdate(value, {works:[]})); checks++;
  const directory = await mkdtemp(path.join(tmpdir(), 'simple-download-update-'));
  try {
    // Execute the real build script in a small isolated source tree, never alter production dist.
    for (const name of ['site','vendor','works','assets/hero/web','assets/fonts','messages','privacy','game','minsheng','game-brief-assets','brand-assets','data','downloads','updates/simple-download-windows']) await mkdir(path.join(directory,name),{recursive:true});
    for (const name of ['index.html','home.css','portal-data.js','portal.css','portal.js','THIRD-PARTY-NOTICES.txt','message-config.js','message-client.js','styles.css','brand.css','site-shell.js','app.js']) await writeFile(path.join(directory,name),'');
    await writeFile(path.join(directory,relativeManifest),JSON.stringify(value)); await writeFile(path.join(directory,'site/works.json'),JSON.stringify(works));
    const builder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build-site.mjs');
    const build = spawnSync(process.execPath,[builder],{cwd:directory,encoding:'utf8'});
    assert.equal(build.status,0,build.stderr); checks++;
    await verifySoftwareUpdates(path.join(directory,'dist'),{requireManifest:true,sourceRoot:directory}); checks++;
    await rm(path.join(directory,'dist',relativeManifest));
    await assert.rejects(() => verifySoftwareUpdates(path.join(directory,'dist'),{sourceRoot:directory})); checks++;
  } finally { await rm(directory,{recursive:true,force:true}); }
  return checks;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checks = await selfTest();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = await verifySoftwareUpdates(root, {requireManifest:process.argv.includes('--require-manifest')});
  console.log(JSON.stringify({checks, ...result}));
}
