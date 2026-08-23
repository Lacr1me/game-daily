import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error("Refusing to clean an unexpected output directory.");
}

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "data"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(path.join(root, file), path.join(output, file));
}
await cp(path.join(root, "game-brief-assets"), path.join(output, "game-brief-assets"), { recursive: true });

for (const file of await readdir(path.join(root, "data"))) {
  if (file.endsWith(".json") || file === "embedded.js") {
    await cp(path.join(root, "data", file), path.join(output, "data", file));
  }
}
await writeFile(path.join(output, ".nojekyll"), "", "utf8");
console.log(`Built static site at ${output}`);
