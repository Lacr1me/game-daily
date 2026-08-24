import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error("Refusing to clean an unexpected output directory.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ["index.html", "portal.css", "portal.js", "styles.css", "brand.css", "app.js"]) {
  await cp(path.join(root, file), path.join(output, file));
}
await cp(path.join(root, "game"), path.join(output, "game"), { recursive: true });
await cp(path.join(root, "minsheng"), path.join(output, "minsheng"), { recursive: true });
await cp(path.join(root, "game-brief-assets"), path.join(output, "game-brief-assets"), { recursive: true });
await cp(path.join(root, "brand-assets"), path.join(output, "brand-assets"), { recursive: true });
await cp(path.join(root, "data"), path.join(output, "data"), { recursive: true });
await cp(path.join(root, "downloads"), path.join(output, "downloads"), { recursive: true });
await rm(path.join(output, "data", ".pending"), { recursive: true, force: true });
await writeFile(path.join(output, ".nojekyll"), "", "utf8");
console.log(`Built static site at ${output}`);
