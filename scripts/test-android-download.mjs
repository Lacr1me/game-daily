import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { androidDownloadName, androidDownloadUrl, stageAndroidDownload, verifyAndroidDownload } from './android-download.mjs';

const bytes = Buffer.from('Controlled APK fixture only; no network');
const manifest = {
  version: '2.3.60', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  downloadUrl: 'https://github.com/Lacr1me/springhues-releases/releases/download/simple-download-android-v2.3.60/SimpleDownload-2.3.60-Android.apk'
};
function response(data = bytes, init = {}) {
  return new Response(new ReadableStream({ start(controller) {
    controller.enqueue(data.subarray(0, 4));
    controller.enqueue(data.subarray(4));
    controller.close();
  } }), init);
}
const directory = await mkdtemp(path.join(tmpdir(), 'android-download-'));
let checks = 0;
try {
  assert.equal(androidDownloadName('2.3.60'), '简单下载-2.3.60.apk'); checks++;
  assert.equal(androidDownloadUrl('2.3.60'), `https://springhues.com/downloads/software/${encodeURIComponent('简单下载-2.3.60.apk')}`); checks++;
  assert.equal(androidDownloadName('2.3.00'), '简单下载-2.3.00.apk'); checks++;
  for (const version of ['../2.3.60', '2.3.60/../x', '2.3.60\\x', '2.3.60?x', '2.3.%2f', '2.3', '2.3.001', '02.3.60', null]) {
    assert.throws(() => androidDownloadName(version), /version/); checks++;
  }
  const valid = path.join(directory, 'valid');
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, manifest.downloadUrl);
    assert.ok(options.signal instanceof AbortSignal);
    return response(bytes, { headers: { 'content-length': String(bytes.length) } });
  };
  const staged = await stageAndroidDownload(valid, manifest, { fetchImpl });
  assert.equal(staged.reused, false);
  assert.equal(path.basename(staged.path), '简单下载-2.3.60.apk');
  assert.deepEqual(await readFile(staged.path), bytes);
  assert.equal((await verifyAndroidDownload(valid, manifest)).sha256, manifest.sha256); checks++;
  assert.equal((await stageAndroidDownload(valid, manifest, { fetchImpl })).reused, true);
  assert.equal(calls, 1); checks++;
  assert.deepEqual(await readdir(path.dirname(staged.path)), ['简单下载-2.3.60.apk']); checks++;

  const failures = [
    [{ ...manifest, size: bytes.length + 1 }, () => response(), /size mismatch/],
    [{ ...manifest, size: bytes.length - 1 }, () => response(), /exceeds/],
    [{ ...manifest, sha256: '0'.repeat(64) }, () => response(), /sha256 mismatch/],
    [manifest, () => response(bytes, { status: 404 }), /HTTP 404/],
    [manifest, () => response(bytes, { status: 206 }), /HTTP 206/],
    [manifest, () => response(bytes, { headers: { 'content-length': '1' } }), /Content-Length/],
    [manifest, () => new Response(null), /no body/],
    [manifest, () => new Response(new ReadableStream({ pull(controller) { controller.error(new Error('broken stream')); } })), /broken stream/]
  ];
  for (const [index, [value, reply, error]] of failures.entries()) {
    const output = path.join(directory, `failure-${index}`);
    await assert.rejects(() => stageAndroidDownload(output, value, { fetchImpl: async () => reply() }), error);
    assert.deepEqual(await readdir(path.join(output, 'downloads/software')), [], 'failed download must leave no target or temporary file');
    checks++;
  }
  for (const mutation of [
    { version: '../2.3.60' }, { size: 0 }, { size: 268435457 }, { size: 4.5 }, { size: '40' },
    { sha256: 'bad' }, { sha256: 'A'.repeat(64) },
    { downloadUrl: manifest.downloadUrl + '?download=1' },
    { downloadUrl: manifest.downloadUrl.replace('Lacr1me', 'someone') },
    { downloadUrl: manifest.downloadUrl.replace('https:', 'http:') },
    { downloadUrl: manifest.downloadUrl.replaceAll('2.3.60', '2.3.59') }
  ]) {
    await assert.rejects(() => stageAndroidDownload(path.join(directory, 'unsafe'), { ...manifest, ...mutation }, {
      fetchImpl: async () => assert.fail('invalid manifests must not reach fetch')
    }));
    checks++;
  }
  await assert.rejects(() => stageAndroidDownload('', manifest), /output path/); checks++;

  // An invalid existing copy is kept on failure, then replaced only by verified bytes.
  const repair = path.join(directory, 'repair');
  const repairDirectory = path.join(repair, 'downloads/software');
  await mkdir(repairDirectory, { recursive: true });
  const repairPath = path.join(repairDirectory, androidDownloadName(manifest.version));
  const damaged = Buffer.alloc(bytes.length, 120);
  await writeFile(repairPath, damaged);
  await assert.rejects(() => verifyAndroidDownload(repair, manifest), /sha256 mismatch/); checks++;
  await assert.rejects(() => stageAndroidDownload(repair, manifest, { fetchImpl: async () => response(damaged) }), /sha256 mismatch/);
  assert.deepEqual(await readFile(repairPath), damaged);
  assert.deepEqual(await readdir(repairDirectory), [androidDownloadName(manifest.version)]); checks++;
  await stageAndroidDownload(repair, manifest, { fetchImpl });
  assert.deepEqual(await readFile(repairPath), bytes); checks++;
  await writeFile(repairPath, 'short');
  await assert.rejects(() => verifyAndroidDownload(repair, manifest), /size mismatch/); checks++;
  console.log(JSON.stringify({ checks, networkRequests: 0, status: 'pass' }));
} finally {
  assert.equal(path.dirname(directory), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith('android-download-'));
  await rm(directory, { recursive: true, force: true });
}
