import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const versionPattern = /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.([0-9]{2}|0|[1-9][0-9]{0,5})$/;
const timeoutMs = 180_000;

export function androidDownloadName(version) {
  if (typeof version !== 'string' || !versionPattern.test(version)) throw new Error('Invalid Android version');
  return `简单下载-${version}.apk`;
}

export function androidDownloadUrl(version) {
  return `https://springhues.com/downloads/software/${encodeURIComponent(androidDownloadName(version))}`;
}

function downloadSpec(output, manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid Android manifest');
  const name = androidDownloadName(manifest.version);
  const source = `https://github.com/Lacr1me/springhues-releases/releases/download/simple-download-android-v${manifest.version}/SimpleDownload-${manifest.version}-Android.apk`;
  if (manifest.downloadUrl !== source) throw new Error('Unexpected Android download source');
  if (!Number.isSafeInteger(manifest.size) || manifest.size < 2 || manifest.size > 268435456) throw new Error('Invalid Android download size');
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Invalid Android download sha256');
  if (typeof output !== 'string' || !output.trim() || output.includes('\0')) throw new Error('Invalid Android output path');
  const root = path.resolve(output);
  const directory = path.join(root, 'downloads', 'software');
  return { root, directory, file: path.join(directory, name), name, source, size: manifest.size, sha256: manifest.sha256 };
}

async function checkDirectories(spec, create) {
  for (const directory of [spec.root, path.join(spec.root, 'downloads'), spec.directory]) {
    if (create) await mkdir(directory, { recursive: true });
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe Android output directory');
  }
}

function mismatch(message) {
  return Object.assign(new Error(message), { code: 'ERR_ANDROID_DOWNLOAD_MISMATCH' });
}

async function verifyFile(spec) {
  const info = await lstat(spec.file);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('Unsafe Android download target');
  if (info.size !== spec.size) throw mismatch('Android download size mismatch');
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(spec.file)) {
    size += chunk.length;
    if (size > spec.size) throw mismatch('Android download exceeds manifest size');
    hash.update(chunk);
  }
  if (size !== spec.size) throw mismatch('Android download size mismatch');
  if (hash.digest('hex') !== spec.sha256) throw mismatch('Android download sha256 mismatch');
  return { path: spec.file, size, sha256: spec.sha256 };
}

export async function verifyAndroidDownload(output, manifest) {
  const spec = downloadSpec(output, manifest);
  await checkDirectories(spec, false);
  return verifyFile(spec);
}

export async function stageAndroidDownload(output, manifest, { fetchImpl = fetch } = {}) {
  const spec = downloadSpec(output, manifest);
  await checkDirectories(spec, true);
  try {
    return { ...await verifyFile(spec), reused: true };
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ERR_ANDROID_DOWNLOAD_MISMATCH') throw error;
  }
  const temporary = path.join(spec.directory, `.${spec.name}.${randomUUID()}.tmp`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Android download timed out')), timeoutMs);
  timeout.unref();
  let handle;
  let response;
  try {
    response = await fetchImpl(spec.source, { signal: controller.signal, redirect: 'follow' });
    if (response.status !== 200) throw new Error(`Android download HTTP ${response.status}`);
    if (!response.body) throw new Error('Android download has no body');
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/.test(length) || Number(length) !== spec.size)) throw mismatch('Android download Content-Length mismatch');
    handle = await open(temporary, 'wx', 0o644);
    const hash = createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk, encoding, callback) {
        size += chunk.length;
        if (size > spec.size) return callback(mismatch('Android download exceeds manifest size'));
        hash.update(chunk);
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), meter, handle.createWriteStream(), { signal: controller.signal });
    if (size !== spec.size) throw mismatch('Android download size mismatch');
    if (hash.digest('hex') !== spec.sha256) throw mismatch('Android download sha256 mismatch');
    controller.signal.throwIfAborted();
    await rename(temporary, spec.file);
    return { path: spec.file, size, sha256: spec.sha256, reused: false };
  } finally {
    clearTimeout(timeout);
    controller.abort();
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
    if (handle) {
      await handle.close();
      await rm(temporary, { force: true });
    }
  }
}
