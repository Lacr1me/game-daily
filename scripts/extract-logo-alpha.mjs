import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const runtimeModules = process.env.CODEX_NODE_MODULES;
if (!runtimeModules) throw new Error("CODEX_NODE_MODULES is required");
const require = createRequire(path.join(runtimeModules, "package.json"));
const sharp = require("sharp");

const root = process.cwd();
const input = path.join(root, "brand-assets", "springhues-logo.png");
const output = path.join(root, "brand-assets", "springhues-logo-transparent.tmp.png");

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const result = Buffer.alloc(info.width * info.height * 4);
const edgeSample = Math.max(32, Math.round(info.width * 0.025));
let minX = info.width;
let minY = info.height;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < info.height; y += 1) {
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let samples = 0;

  for (let x = 0; x < edgeSample; x += 1) {
    for (const sampleX of [x, info.width - 1 - x]) {
      const sampleOffset = (y * info.width + sampleX) * 4;
      bgR += data[sampleOffset];
      bgG += data[sampleOffset + 1];
      bgB += data[sampleOffset + 2];
      samples += 1;
    }
  }

  bgR /= samples;
  bgG /= samples;
  bgB /= samples;

  for (let x = 0; x < info.width; x += 1) {
    const offset = (y * info.width + x) * 4;
    const alphaR = 1 - data[offset] / bgR;
    const alphaG = 1 - data[offset + 1] / bgG;
    const alphaB = 1 - data[offset + 2] / bgB;
    let alpha = Math.round(Math.max(0, (alphaR + alphaG + alphaB) / 3) * 255);

    if (alpha < 20) alpha = 0;
    if (alpha > 248) alpha = 255;

    result[offset] = 0;
    result[offset + 1] = 0;
    result[offset + 2] = 0;
    result[offset + 3] = alpha;

    if (alpha > 0) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

await sharp(result, {
  raw: { width: info.width, height: info.height, channels: 4 }
})
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);

console.log(JSON.stringify({
  output,
  width: info.width,
  height: info.height,
  contentBounds: { minX, minY, maxX, maxY }
}));
