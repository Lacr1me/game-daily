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
  assert.equal(value.installerUrl, `${base}download/${tag}/SimpleDownload-${value.version}-Windows-Setup.exe`, 'legacy client requires the exact ASCII compatibility asset');
  assert.equal(value.releasePageUrl, `${base}tag/${tag}`);
  const work = works.works.find(item => item.slug === 'simple-download-windows');
  assert.ok(work, 'Windows work entry required'); assert.equal(work.version, value.version);
  if (work.releaseAssets !== undefined) {
    const assets = work.releaseAssets;
    assert.deepEqual(Object.keys(assets).sort(), ['releaseId','installer','legacyInstaller','archive'].sort(), 'explicit release asset mapping');
    assert.equal(assets.releaseId, value.releaseId, 'all assets belong to the same release');
    const validateAsset = (asset, name, displayName) => {
      assert.deepEqual(Object.keys(asset).sort(), ['fileName','displayName','url','size','sha256'].sort(), 'release asset fields');
      assert.equal(asset.fileName, name);
      assert.equal(asset.displayName, displayName, 'Chinese versioned display name');
      assert.equal(asset.url, `${base}download/${tag}/${encodeURIComponent(name)}`, 'asset must use this release and exact filename');
      assert.ok(Number.isSafeInteger(asset.size) && asset.size >= 2 && asset.size <= 2147483648, 'asset size');
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    };
    validateAsset(assets.installer, `SimpleDownload-${value.version}-Windows-Setup.exe`, `简单下载-${value.version}.exe`);
    validateAsset(assets.legacyInstaller, `SimpleDownload-${value.version}-Windows-Setup.exe`, `简单下载-${value.version}.exe`);
    validateAsset(assets.archive, `SimpleDownload-${value.version}.zip`, `简单下载-${value.version}.zip`);
    assert.deepEqual(assets.installer, assets.legacyInstaller, 'website and legacy client share one installer asset');
    for (const asset of [assets.installer, assets.legacyInstaller]) {
      assert.equal(asset.size, value.size, 'primary and compatibility installers have identical bytes');
      assert.equal(asset.sha256, value.sha256, 'primary and compatibility installers have identical digest');
    }
    assert.equal(assets.legacyInstaller.url, value.installerUrl);
    assert.ok(work.links.some(link => link.kind === 'download' && link.href === assets.installer.url && link.label === assets.installer.displayName), 'primary download shows the Chinese installer name and uses its actual remote URL');
    assert.ok(work.links.some(link => link.kind === 'download' && link.href === assets.archive.url && link.label === assets.archive.displayName), 'archive download shows the Chinese ZIP name and uses its actual remote URL');
  } else {
    assert.ok(work.links.some(link => link.kind === 'download' && link.href === value.installerUrl), 'legacy entry download must match immutable manifest package');
  }
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
  // Keep the legacy schema consumed by published 0.2.1 clients. Only website metadata
  // carries Chinese display names and exact ASCII remote names; no new manifest fields.
  const assetBase = value.installerUrl.slice(0, value.installerUrl.lastIndexOf('/') + 1);
  const releaseAssets = {
    releaseId:value.releaseId,
    installer:{fileName:'SimpleDownload-0.2.1-Windows-Setup.exe',displayName:'简单下载-0.2.1.exe',url:value.installerUrl,size:value.size,sha256:value.sha256},
    legacyInstaller:{fileName:'SimpleDownload-0.2.1-Windows-Setup.exe',displayName:'简单下载-0.2.1.exe',url:value.installerUrl,size:value.size,sha256:value.sha256},
    archive:{fileName:'SimpleDownload-0.2.1.zip',displayName:'简单下载-0.2.1.zip',url:assetBase+'SimpleDownload-0.2.1.zip',size:4,sha256:'2'.repeat(64)}
  };
  const mappedWorks = {works:[{slug:'simple-download-windows',version:value.version,releaseAssets,links:[
    {kind:'download',label:releaseAssets.installer.displayName,href:releaseAssets.installer.url},{kind:'download',label:releaseAssets.archive.displayName,href:releaseAssets.archive.url},{kind:'visit',href:value.releasePageUrl}
  ]}]};
  validateSoftwareUpdate(value,mappedWorks); checks++;
  for (const mutation of [
    work => { work.releaseAssets.releaseId = 'different-0001'; },
    work => { work.releaseAssets.installer.sha256 = '3'.repeat(64); },
    work => { work.releaseAssets.legacyInstaller.size++; },
    work => { work.releaseAssets.installer.url = work.releaseAssets.installer.url.replace('Lacr1me','someone'); },
    work => { work.releaseAssets.archive.fileName = 'SimpleDownload-0.2.0.zip'; },
    work => { work.releaseAssets.installer.displayName = '简单下载-0.2.0.exe'; },
    work => { work.releaseAssets.installer.url = assetBase + encodeURIComponent('简单下载-0.2.1.exe'); },
    work => { work.links[0].label = work.releaseAssets.installer.fileName; },
    work => { work.releaseAssets.installer.url += '?download=1'; },
    work => { work.links = work.links.filter(link => link.href !== work.releaseAssets.installer.url); },
    work => { work.links = work.links.filter(link => link.href !== work.releaseAssets.archive.url); },
    work => { work.releaseAssets.installer.fileName = 'SimpleDownload-0.2.1.exe'; work.releaseAssets.installer.url = assetBase + 'SimpleDownload-0.2.1.exe'; }
  ]) {
    const changed = structuredClone(mappedWorks); mutation(changed.works[0]);
    assert.throws(() => validateSoftwareUpdate(value,changed)); checks++;
  }
  assert.throws(() => validateSoftwareUpdate({...value,fileName:'简单下载-0.2.1.exe'},mappedWorks)); checks++;
  assert.throws(() => validateSoftwareUpdate({...value,installerUrl:assetBase+encodeURIComponent('简单下载-0.2.1.exe')},mappedWorks)); checks++;
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
