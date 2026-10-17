// 把当前仓库的前端同步到公开镜像仓库 springhues-site。
// 用法：node scripts/sync-public-mirror.mjs [--mirror <本地镜像目录>]
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const mirrorDir = path.resolve(arg("--mirror", path.join(root, ".mirror", "springhues-site")));
const remote = "https://github.com/Lacr1me/springhues-site.git";
const branch = "site";
const proxy = process.env.SYNC_PROXY || "";
const git = (cwd, list) => execFileSync("git", list, { cwd, stdio: "pipe", encoding: "utf8" });

const KEEP_SCRIPTS = new Set([
  "build-embedded.mjs", "build-hero-assets.mjs", "build-site.mjs", "check-shard-style.mjs",
  "serve.mjs", "test-home.mjs", "verify-build.mjs", "archive-consistency.mjs",
  "color-family.mjs", "game-lib.mjs", "minsheng-lib.mjs", "source-registry.mjs"
]);
const PRIVATE = [
  "admin", "supabase", "artifacts", "docs", "design-records", "daily-brief-template-package",
  ".github", "mirror", "AGENTS.md", "build_daily_brief.mjs", "config/daily-execution-policy.json",
  "每日民生日报参考图.png", "民生日报-2026-08-23.html", "民生日报-2026-08-23.png"
];

const temp = await mkdtemp(path.join(os.tmpdir(), "springhues-mirror-"));
try {
  const stage = path.join(temp, "stage");
  await mkdir(stage, { recursive: true });
  const tar = path.join(temp, "head.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tar, "HEAD"], { cwd: root, stdio: "pipe" });
  execFileSync("tar", ["--force-local", "-xf", tar, "-C", stage], { stdio: "pipe" });

  const docs = ["shard-style.md", "shard-style-prompt.txt"];
  for (const rel of PRIVATE) await rm(path.join(stage, rel), { recursive: true, force: true });
  const scriptsDir = path.join(stage, "scripts");
  for (const entry of await readdir(scriptsDir)) {
    if (!KEEP_SCRIPTS.has(entry)) await rm(path.join(scriptsDir, entry), { recursive: true, force: true });
  }
  await mkdir(path.join(stage, "docs"), { recursive: true });
  for (const name of docs) await cp(path.join(root, "docs", name), path.join(stage, "docs", name));
  for (const name of ["LICENSE", "NOTICE.md", "README.md"]) await cp(path.join(root, "mirror", name), path.join(stage, name));

  if (!(await exists(path.join(mirrorDir, ".git")))) {
    await mkdir(path.dirname(mirrorDir), { recursive: true });
    execFileSync("git", [...(proxy ? ["-c", `http.proxy=${proxy}`] : []), "clone", "--depth", "1", "--branch", branch, remote, mirrorDir], { stdio: "pipe" });
  } else {
    git(mirrorDir, ["fetch", "origin", branch]);
    git(mirrorDir, ["checkout", "-B", branch, `origin/${branch}`]);
  }
  git(mirrorDir, ["reset", "--hard", `origin/${branch}`]);

  for (const entry of await readdir(mirrorDir)) {
    if (entry !== ".git") await rm(path.join(mirrorDir, entry), { recursive: true, force: true });
  }
  for (const entry of await readdir(stage)) await cp(path.join(stage, entry), path.join(mirrorDir, entry), { recursive: true });

  const name = execFileSync("git", ["config", "user.name"], { cwd: root, encoding: "utf8" }).trim() || "Lacr1me";
  const email = execFileSync("git", ["config", "user.email"], { cwd: root, encoding: "utf8" }).trim() || "Lacr1me@users.noreply.github.com";
  git(mirrorDir, ["add", "-A"]);
  if (!git(mirrorDir, ["status", "--porcelain"]).trim()) {
    console.log("镜像已是最新，无需推送。");
  } else {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    git(mirrorDir, ["-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-m", `Sync frontend mirror from game-daily ${sha}`]);
    const pushArgs = proxy ? ["-c", `http.proxy=${proxy}`, "push", "origin", branch] : ["push", "origin", branch];
    git(mirrorDir, pushArgs);
    console.log(`镜像已更新：${branch}`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

async function exists(target) { try { await stat(target); return true; } catch { return false; } }
