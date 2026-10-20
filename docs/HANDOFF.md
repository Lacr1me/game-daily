# Springhues 网站交接手册

写给接手的 AI 或人。目标：不问原作者，也能独立完成「改作品、发软件新版本、改样式、提交上线、排查问题」。
写于 2026-10-17，对应提交 `2e8d6b8` 之后的状态。下面凡是写了命令的地方，都是在这台 Windows 机器的 PowerShell 里实测过的。

> 阅读顺序：本文 → `AGENTS.md`（项目硬约束，日报生产相关内容以它和 `docs/daily-runbook.md` 为准）→ 要改样式再读 `docs/shard-style.md`。
> 冲突时的优先级：用户当次要求 > `AGENTS.md` > 本文 > 其它旧文档。`README.md`、`.agents/` 草稿、历史 HTML/PNG 只用于追溯。

---

## 1. 一分钟总览

- 这是 **springhues.com**：作者 Lacr1me 的个人作品站，展示软件、网页、游戏资源，以及一个每天 11:00 自动更新的「每日简报」（游戏日报 + 民生日报）。
- 技术：**纯静态**（HTML、CSS、原生 JavaScript ES 模块、JSON、图片）。**不使用前端框架，不使用 npm / package.json**。Node.js 脚本只用来测试、构建、发布。
- 部署：推送到 GitHub `main` → GitHub Actions（`.github/workflows/pages.yml`）跑测试 → `scripts/build-site.mjs` 生成 `dist/` → 发布到 GitHub Pages。**推送 main 就是上线**。
- 风格：SHARD（碎片）。克莱因蓝为主、冷白为辅、勃艮第红只当「刃」，所有容器是切角多边形，不用圆角矩形。详见 `docs/shard-style.md`。
- 作者在中国，**用户主要在国内**。这影响下载分发（见第 10 节）。
- 作者的额度有限，已经把后续维护交给你。能用最少的步骤把事做对，比做得花哨更重要。

### 仓库与线上资源清单

| 名称 | 地址 | 用途 |
|---|---|---|
| 网站源码仓库 | https://github.com/Lacr1me/game-daily （默认分支 `main`） | 本仓库；Pages 发布源；日报自动化也会往这里推送 |
| 软件发布仓库 | https://github.com/Lacr1me/springhues-releases | 「软件工具」分类的安装包，只用 GitHub Releases |
| 游戏资源发布仓库 | https://github.com/Lacr1me/springhues-games | 「游戏资源」分类（Mod、整合包、小游戏），只用 Releases |
| 网页设计仓库 | https://github.com/Lacr1me/springhues-web | 「网页设计」分类，目前为空，只有 README |
| 线上站点 | https://springhues.com/ | 首页、`game/`、`minsheng/`、`messages/`、`privacy/` |

- 本机 `gh`（GitHub CLI）已登录账号 `Lacr1me`，令牌权限含 `repo`、`workflow`。**不要把令牌、`.env`、密钥提交进任何仓库，也不要在回复里回显。**
- 本机仓库根目录：`f:\Codex-App\日报设计`。

### 当前已上线的作品（`site/works.json`）

| slug | 分类 | 载体 | 版本 | 下载位置 |
|---|---|---|---|---|
| `simple-download-windows` | 软件工具 | window | 0.2.1 | springhues-releases，tag `simple-download-windows-v0.2.1-20261018T152358Z-ede0cc5e` |
| `simple-download-android` | 软件工具 | phone | 2.3.4 | springhues-releases，tag `simple-download-android-v2.3.4` |
| `n1ten` | 游戏资源 | shard（通用） | 1.5.2 | springhues-games，tag `n1ten-v1.5.2` |
| `daily-game` / `daily-minsheng` | 每日简报 | page | — | 站内 `game/`、`minsheng/` |

软件源码与安装包在作者本机（不在任何仓库里）：
- 简单下载：`F:\Codex-App\简单下载\`；Windows 安装包 `F:\Codex-App\简单下载\desktop\artifacts\installer\简单下载.exe`；Android 安装包 `F:\Codex-App\简单下载\artifacts\简单下载-2.3.4.apk`；界面截图 `F:\Codex-App\简单下载\output\software-info-20261017\`。
- N1ten 模组：`F:\Codex-App\MC mods\releases\n1ten\1.5.2\N1ten-1.5.2.jar`。

---

## 2. 目录地图

```
index.html               首页结构 + 内联首帧脚本（主题 / 开场 / 站内到达）
site/
  works.json             作品与分类清单（改作品只改这里）
  boot.js                子页面外壳的门控入口（决定是否启用线上外壳）
  css/                   tokens.css（色板）、shard-theme.css（跨页面共享样式）、各区块样式、pages-*.css（子页面）
  js/
    main.js              首页入口（唯一带 ?v= 版本戳的脚本）
    core/                有状态的单例模块：tier、ticker、scroll、wipe、focus、store、tween、flip、url、category……
    data/                works.js（清单校验）、archive.js（读日报索引）
    hero/                首屏 WebGL 与降级
    loader/              开场动画
    wall/                作品墙、筛选、详情、视差、倾斜
    carriers/            载体（phone / window / page / shard）
    ui/                  导航、菜单、命令面板、光标、主题、彩蛋
    shell/               子页面外壳（页首 / 菜单 / 页脚 / 主题切换）
vendor/lenis/            唯一的第三方库：Lenis（MIT），本地托管
assets/hero/web/         首屏主视觉的网页尺寸衍生图（jpg / webp）
assets/fonts/            Anton 字体（OFL）
game/  minsheng/         日报频道页（线上页同时是导出 PNG 的渲染源，见第 9 节）
messages/  privacy/      留言簿、隐私说明
admin/                   后台（无公开入口，不要加链接，不要改）
data/                    日报正文与索引（由发布脚本维护，不要手改）
downloads/               公开 PNG（日报导出图）
scripts/                 测试 / 构建 / 校验 / 发布脚本
docs/                    本文、shard-style.md、personal-site.md、daily-runbook.md ……
design-records/          本次改版的三份总结报告（历史记录，不部署）
dist/                    构建产物，被 git 忽略，禁止手改
```

不要碰的东西：`data/`、`downloads/`、`artifacts/`、`config/`、`supabase/`、`.github/workflows/`、`admin/`、日报生产脚本、`styles.css`、`brand.css`、`site-shell.js`、两个 `app.js`、`minsheng/*.css`、两个频道 HTML（理由见第 9 节）。

---

## 3. 我想做某件事 → 怎么做

| 想做的事 | 做法 |
|---|---|
| 新增 / 修改一个作品 | 改 `site/works.json` 的 `works`，见第 4 节；跑第 6 节的测试 |
| 发布软件新版本 | 第 5 节：传 Release → 改 `works.json` 里的版本、日期、链接 |
| 新增一个分类 | 在 `categories` 里加一项（`id` 用小写字母加连字符，设 `carrier` / `accent` / `parallax` / `order`）；筛选标签始终显示，没有作品时计数为 `00` 并显示空栏位提示 |
| 给卡片配图 | 目前**故意没有放图**（作者要等做出风格化的图再放）。接入方法见第 4 节末尾 |
| 做新的卡片外形（载体） | 在 `site/js/carriers/` 新增模块，在 `carriers/index.js` 注册，作品用 `"carrier": "名字"`；参考 `phone.js` / `shard.js`。详见 `docs/shard-style.md` 第 10 节 |
| 改首页 / 关于区文案 | 直接改 `index.html` 对应段落（作品区导语、关于三段、页脚） |
| 新建页面并套用风格 | 把 `docs/shard-style-prompt.txt` 整段给 AI；模板在 `docs/shard-style.md` 第 9 节；做完跑 `node scripts/check-shard-style.mjs` |
| 加国内镜像下载链接 | 在作品 `links` 里加一条，见第 10 节 |
| 提交并上线 | 第 6 节 |
| 排查「线上不对」 | 第 6 节「验证线上」与第 12 节「常见坑」 |

---

## 4. `site/works.json` 速查

结构：`{ "schemaVersion": 1, "categories": [...], "works": [...] }`。校验在 `site/js/data/works.js`，**超限的内容会被截断，非法的条目会被丢弃并在控制台警告**。

当前分类（顺序即筛选栏顺序，另有代码提供的「全部资源」）：

| id | 名称 | 默认载体 |
|---|---|---|
| `software` | 软件工具 | window |
| `game` | 游戏资源 | shard |
| `web` | 网页设计 | browser |
| `daily` | 每日简报 | page |

作品字段：

| 字段 | 要求 |
|---|---|
| `slug` | 必填，小写字母数字加连字符，≤64，**全表唯一，发布后不要改**（深链 `#work=<slug>` 依赖它） |
| `category` | 必填，必须是已登记分类 id |
| `name` | 必填，≤60 字 |
| `intro` | 必填，**≤120 字**（卡片和详情头部的一句话简介，超出被截断） |
| `details` | 可选，数组，≤14 段；每段 `{ "h": 小标题(≤28，可空), "p": 正文(≤600) }`，在详情面板里分段展示。长介绍放这里 |
| `tags` | 可选，≤8 个，每个 ≤16 字 |
| `platform` | 可选，≤16 字（如 `Windows`、`Android`、`Forge 1.20.1`） |
| `version` / `updatedAt` | 版本号字符串 / `YYYY-MM-DD` 真实日期 |
| `isNew` | `true` 时卡片出现红色 NEW 角标（红色只当「刃」，别滥用） |
| `carrier` | 可选，`phone` / `window` / `page` / `shard` / `browser`；缺省取分类默认。**同一分类里不同作品可以用不同载体**（软件工具里安卓用 phone、Windows 用 window） |
| `links` | ≤6 条，每条 `{ "kind": "download"|"visit"|"source"|"channel", "label": ≤24 字, "href": ... }`。**href 只允许** `#`、站内相对路径、`https://…`；`javascript:`、`data:`、`http:`、含账号密码的地址、指向 `admin` 的地址一律被拒。`links` 为空时详情页显示「下载即将开放」 |
| `cover` / `shots` | 见下 |
| `layout.size` | `s` / `m` / `l`，决定卡片大小；不写则按 slug 稳定随机 |
| `source` | 仅日报卡使用：`{type:"daily-archive", manifest, base, fallbackTitle}`，**manifest 与 base 必须成对**（`data/index.json`+`game/` 或 `data/minsheng/index.json`+`minsheng/`），不要改 |
| `prompt` | 可选，提示词文本文件路径，只允许 `works/<slug>/<文件名>.txt`。详情面板会出现「复制提示词」按钮，正文不展示 |
| `model` | 可选，≤40 字，制作时使用的模型名，显示在详情面板的「模型」一栏 |

接入真实配图的步骤（作者以后有了风格化图再做）：
1. 图片放进 `assets/works/`，文件名只用 ASCII（`[A-Za-z0-9._/-]`），单张 <1MB。
2. 在 `scripts/build-site.mjs` 里把 `"assets/works"` 加回复制白名单（该行是 `for (const dir of ["site", "vendor", "assets/hero/web", "assets/fonts"])`）。**目录必须存在，否则构建会报错**。
3. 作品里写 `"cover": {"kind":"image","src":"assets/works/xxx.png","alt":"…(≤80字)","width":整数,"height":整数}`，`shots` 里可加 `{"label":…,"ratio":"16/9","src":…}`。
4. phone / window 载体已支持显示 `cover` 图（`site/css/carriers.css` 末尾的 `has-shot` 规则）；其它载体暂不显示封面图，需要时自己加。
5. 跑测试；`scripts/test-home.mjs` 会检查图片文件是否真实存在、是否位于 `assets/works/`。

---

## 5. 发布软件（Release 流程，已实测）

原则：**安装包永远不进网站仓库**（仓库已接近体积上限，见第 12 节）；一律走各分类仓库的 GitHub Releases。

约定：
- tag：`<应用>-<平台>-v<版本>`（如 `simple-download-windows-v0.2.0`），模组 / 游戏类 `<名>-v<版本>`（如 `n1ten-v1.5.2`）。
- 附件文件名**只能用 ASCII**（GitHub 会破坏中文文件名）：`<App>-<版本>-<平台>.<扩展名>`，例如 `SimpleDownload-0.2.0-Windows-Setup.exe`、`SimpleDownload-2.3.4-Android.apk`、`N1ten-1.5.2-Forge-1.20.1.jar`。
- 每个安装包旁边附一个同名 `.sha256` 文件，内容 `<小写哈希>  <文件名>`。
- 分类 → 仓库：软件工具 → `springhues-releases`；游戏资源 → `springhues-games`；网页设计 → `springhues-web`。
- 下载直链：`https://github.com/Lacr1me/<仓库>/releases/download/<tag>/<附件文件名>`；发布页：`.../releases/tag/<tag>`。**用带 tag 的直链**，不要用 `latest`（一个仓库里有多个软件，`latest` 只指最近一个 Release）。

命令模板（PowerShell，替换尖括号内容）：

```powershell
$repo  = 'Lacr1me/springhues-releases'          # 或 springhues-games
$tag   = 'simple-download-windows-v0.3.0'
$asset = 'SimpleDownload-0.3.0-Windows-Setup.exe'
$src   = 'F:\Codex-App\简单下载\desktop\artifacts\installer\简单下载.exe'

$stage = Join-Path $env:TEMP 'rel'; New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item -LiteralPath $src "$stage\$asset" -Force
$h = (Get-FileHash "$stage\$asset" -Algorithm SHA256).Hash.ToLower()
Set-Content "$stage\$asset.sha256" "$h  $asset" -Encoding ASCII
Set-Content "$stage\notes.md" "<标题与版本说明>`n`n- 文件：$asset`n- SHA-256：$h`n`n主页：https://springhues.com/" -Encoding UTF8

gh release create $tag "$stage\$asset" "$stage\$asset.sha256" --repo $repo --title "<标题>" --notes-file "$stage\notes.md"

# 核对：GitHub 算出的 digest 必须等于本地 $h
gh release view $tag --repo $repo --json isDraft,assets
Invoke-WebRequest -Uri "https://github.com/$repo/releases/download/$tag/$asset" -Method Head -UseBasicParsing | Select-Object StatusCode
Remove-Item -Recurse -Force $stage
```

然后改 `site/works.json` 对应作品：`version`、`updatedAt`、`links` 的 href 与 label（label ≤24 字，写上大小，如「下载安装包（262 MB）」），保留一条「发布页与校验值」。再按第 6 节提交上线。

注意：
- 262 MB 的 exe 上传约半分钟；超过 2 GB 的单文件 GitHub 不接受。
- 如果工具在长命令后吞掉输出，用单独的命令再查一次 `gh release list --repo <repo>` 确认结果。
- 发布软件只传作者明确指定的文件。不要主动上传别的东西。

---

## 6. 提交、测试、上线

**日报自动化也会往 `main` 推送**（提交信息形如 `Publish verified game 55 and minsheng 57 for …`），所以每次提交前后都要对齐远端。

主目录里目前有**与网站改版无关的未提交改动**，绝对不要 `git add .` / `git add -A`：
- 已修改：`minsheng/mobile-fix.css`、`scripts/collect-steam-discovery.mjs`、`scripts/test-collect-steam-discovery.mjs`
- 未跟踪：`game-brief-assets/` 下大量新图、`offline-homepage-editor/`、`output/`、`docs/session-handoff-2026-08-25.md`、`.codex/`、`.playwright-cli/`、`.graphflow-cache/`、`scripts/local-maintenance.ps1`、`scripts/perf-check.ps1`、`scripts/test-offline-homepage-editor.mjs` 等

### 步骤

```powershell
cd f:\Codex-App\日报设计
git status --short                       # 先看清楚，只挑自己改的文件
git fetch origin
git log --oneline HEAD..origin/main      # 远端有新提交（日报发布）就要先对齐
```

1. 测试（和 CI 一致的那一组，**必须全过**）：
   ```powershell
   node scripts/test-daily-operations.mjs
   node scripts/test-site.mjs          # 含首页单测 scripts/test-home.mjs 与 test-portal-data
   node scripts/test-messages.mjs
   node scripts/test-admin-logs.mjs
   node scripts/check-shard-style.mjs  # 样式合规（不在 CI 里，但改了样式 / 页面必跑）
   ```
   改了日报页或其外壳之后，另跑 `node scripts/check-export-parity.mjs --channel=both`（用真实导出器对比 HTML / PNG，只写系统临时目录）。
2. 构建与校验（`build-site.mjs` 会先清空并重建 `dist/`）：
   ```powershell
   node scripts/build-site.mjs
   node scripts/verify-build.mjs
   ```
   `dist/` 被 git 忽略、可再生成，但**日报制作进行中不要运行**。出于谨慎，上一轮是在另一个 worktree 里跑的（`git worktree add`），需要时可以照做。
3. 只暂存自己的文件并提交（提交信息用英文祈使句，和历史一致）：
   ```powershell
   git add site/works.json index.html          # 示例：写具体文件名
   git diff --cached --stat                    # 复核
   git commit -m "Add <what> to works"
   ```
4. 对齐远端（如有新提交）：
   ```powershell
   git rebase --autostash origin/main          # 工作区有无关未提交改动时用 --autostash
   ```
   有冲突就停下，不要强推，不要丢弃别人的改动。
5. 推送（**这一步就是上线**；只有用户明确同意才推送，直接推 `main` 也要用户明确说了才行）：
   ```powershell
   git push origin main
   # 如果报 "Failed to connect to github.com:443" 或 "Connection was reset"：见第 15 节“git 连不上 GitHub”，
   # 作者电脑开着本地代理 127.0.0.1:7897，git 默认不走它，临时指定即可（不改任何 git 配置）：
   git -c http.proxy=http://127.0.0.1:7897 push origin main
   ```
6. 看部署结果：
   ```powershell
   gh run list --limit 3                       # status / conclusion
   gh run view <id> --log-failed               # 失败时看原因
   ```
7. 验证线上（不要只看 Actions 变绿）：
   ```powershell
   $ProgressPreference='SilentlyContinue'
   (Invoke-WebRequest "https://springhues.com/?t=$(Get-Random)" -UseBasicParsing).StatusCode
   (Invoke-WebRequest "https://springhues.com/site/works.json?t=$(Get-Random)" -UseBasicParsing).Content | Select-String '你刚改的内容'
   ```
   GitHub Pages 有约 10 分钟的缓存，浏览器强制刷新用 Ctrl+F5。

### 回滚

```powershell
git revert <有问题的提交>      # 生成一个反向提交
git push origin main
```
不要 `git reset --hard`、不要强推 `main`。

### 流水线细节

- `pages.yml`：checkout → Node 22 → `build-embedded.mjs` → 四个测试脚本 → `build-site.mjs` → `verify-build.mjs` → 部署 Pages → 同步网站变更日志（`continue-on-error`，需要仓库密钥 `ADMIN_LOG_SYNC_SECRET`）。
- 任一测试失败，**不会部署**，线上保持上一版。
- 构建是**白名单复制**：新增的目录 / 文件如果不在 `scripts/build-site.mjs` 的列表里，就不会出现在线上。`verify-build.mjs` 里也有对应断言，两处要一起改。
- 测试里有几条「护栏」，改动时会撞到，是刻意的：`test-home.mjs` 禁止在 `site/ scripts/ vendor/ docs/ index.html AGENTS.md privacy/ game/ minsheng/ messages/` 里出现已移除的第三方动画库的名字（所以写文档时别提它的名字）；`works.json` 里的站内链接只允许两个日报入口，其余必须 `https://`；5MB 的首屏原图不能进 `dist/`。

### 缓存版本戳

- `index.html` 里样式和入口脚本带 `?v=20261018-shard-v4`，子页面和 `scripts/check-shard-style.mjs` 里的 `SHARD_VERSION` 是同一个值，**四处必须一致**（`test-site` / `check-shard-style` 会查）。
- 想让老访客立刻拿到新样式，就统一递增这个值（`index.html`、4 个子页面、`SHARD_VERSION`）。不递增的话，GitHub Pages 的 10 分钟缓存过后自然更新，通常够用。
- `site/js/` 下除 `main.js` 外的模块在源码里没有版本戳，**导出签名只增不改**；`build-site.mjs` 会在构建产物里给所有相对 `import` 自动追加 `?v=<提交 SHA>`，所以每次部署都会让浏览器重新下载模块，不需要手改导入。
- `works.json` 属于数据文件，仍受 GitHub Pages 的 10 分钟缓存约束；改了作品后老访客最多等 10 分钟。

### 公开前端镜像

- 仓库：https://github.com/Lacr1me/springhues-site ，分支 `site`。MIT 只覆盖前端代码，内容与作品保留权利（见仓库里的 `NOTICE.md`）。
- 同步：`node scripts/sync-public-mirror.mjs`。首次会自动 clone 到 `.mirror/springhues-site`；需要代理时用 `SYNC_PROXY=http://127.0.0.1:7897`。
- 只同步前端、内容与构建脚本。后台 `admin/`、`supabase/`、自动化与日报脚本、内部文档、`config/daily-execution-policy.json` 都不会进入镜像。
- 线上部署仍由本仓库负责，镜像仓库不参与部署。

---

## 7. 本地预览与验证

```powershell
cd f:\Codex-App\日报设计
$env:PORT = 4173; node scripts/serve.mjs      # 打开 http://127.0.0.1:4173 ；实时读文件，改完刷新即可
```

- 看首页：开场动画同一会话只播一次；想每次跳过，在控制台执行 `sessionStorage.setItem('springhues.home.introSeen','1')`。
- 深链：`/#cat=software`、`/#work=simple-download-windows`、`/#works`、`/#about`。
- 浏览器自动化：脚本里用 `scripts/collect-steam-discovery.mjs` 导出的 `loadPlaywright()`，启动 Edge（`channel: 'msedge'`），WebGL 用 `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。参考 `scripts/verify-home-redesign.mjs`。
- **注意**：`scripts/verify-home-redesign.mjs` 里还写着旧占位作品的 slug（如 `android-sample-note`、`windows-sample-capture`），换成真实作品后其中几项会失败，需要先把这些 slug 改成现有作品。它不在 CI 里，但改动首页后最好修好再跑（`--section=all`）。
- 动效只能在静态帧和逐帧采样层面验证，「丝滑」要真机人眼看。

---

## 8. 样式要点（完整规范见 `docs/shard-style.md`）

- 色板（源头 `site/css/tokens.css`）：克莱因蓝 `#0537B4`（约 60%）、冷白 `#F4F6FF`（约 30%）、勃艮第红 `#90072A`（≤10%，只当「刃」：NEW 角标、关键按钮、强调线、悬停描边）、夜间深蓝 `#0D1850`。颜色一律走变量，不要手写色值。
- 形状：容器用切角 / 斜切 `clip-path`（用工具类，不要写死），**禁止圆角矩形**。唯一允许圆的是状态点、头像等白名单元素。
- 红字不放蓝底，小字不放红底；正文对比度 ≥4.5:1；所有交互可用键盘，焦点可见。
- 动效：只用浏览器原生 WAAPI + `site/js/core/tween.js`；**不要再引入第三方动画库**；必须尊重 `prefers-reduced-motion`。
- 子页面外壳只在 `html.shard-live` 下生效，由 `site/boot.js` 门控。导出器冻结 `Date` 后仍会注入 `__SHARD_FORCE__`，并把 `tokens.css`、`shard-theme.css`、`pages-daily.css` 一并内联，所以日报导出图使用与线上一致的 SHARD 外观；字体以 data URI 内嵌，避免本地静态页的 CORS 拦截。
- 命名：组件类前缀 `sd-`；页面专属样式文件命名 `site/css/pages-<名字>.css`。

---

## 9. 日报系统：不可破坏的约束（摘要，完整见 `AGENTS.md`）

- 每天 11:00（Asia/Shanghai）由自动化制作并发布两个频道；11:00 前禁止发布。**任何网站改动都不要初始化日报运行、不要获取租约、不要手改 `data/`、`downloads/`、`artifacts/`**。
- 日报 HTML / PNG 同源：导出器用本地服务打开 `game/?date=…`、`minsheng/?date=…` 并截图。所以线上日报页的样式一改，导出图就可能变。当前做法是：被导出消费的文件（`styles.css`、`brand.css`、`site-shell.js`、两个 `app.js`、`minsheng/*.css`、两个频道 HTML 的结构）一律不改，线上外壳只通过 `site/boot.js` 的门控额外叠加。
- 改了日报页或其外壳后，必须运行 `node scripts/check-export-parity.mjs --channel=both`，要求 HTML 快照和 PNG 字节完全一致。
- 保留 `?date=YYYY-MM-DD`（无效或未到发布时刻的日期回退到最新已发布期）、下载按钮指向当期 PNG、外链 `rel="noopener noreferrer"`、民生页桌面逐行对齐与移动端高度重置规则。
- 首页的日报卡读 `data/index.json` 与 `data/minsheng/index.json`，只显示已到发布时刻的最新期；`#gameLink` / `#civicLink` 必须留在 DOM 里（线上健康采集会读它们的 `href`）。
- 留言：公开页只展示审核通过的留言，纯文本渲染，配置未完成时安全禁用表单；`message-config.js` 只放公开地址和公开密钥。`admin/` 不得出现在任何公开导航里。

---

## 10. 国内用户下载（镜像）

现状：下载走 GitHub Releases。国内访问有时慢或不稳，262 MB 的 Windows 安装包最明显。**网站这一侧已经支持多下载源**：作品的 `links` 最多 6 条，直接加一条即可，不用改代码：

```json
{ "kind": "download", "label": "国内镜像下载", "href": "https://你的镜像地址/文件" }
```

镜像本身需要作者提供账号，AI 无法代办。可选方案（收益、代价都没有实测，下面是评估，不是事实）：

| 方案 | 优点 | 代价 / 风险 |
|---|---|---|
| Gitee（码云）Releases | 国内访问快，免费，操作类似 | 需要实名账号；附件大小限制**未核实**，262 MB 可能超限，上线前先查最新规则 |
| 国内对象存储 + CDN（阿里云 OSS / 腾讯云 COS / 七牛云等） | 速度稳定，适合以后做自动更新 | 要开通账号并充值；用自有域名需要 ICP 备案；密钥绝不能写进仓库 |
| 网盘分享链接 | 零成本、最快落地 | 手动维护，限速和失效不可控，不适合自动更新 |
| 第三方「GitHub 加速代理」 | 不用自己建 | **不推荐**：服务稳定性和安全不可控，文件可能被替换；必须依赖 `.sha256` 自行校验 |

建议顺序：先用 Gitee 或网盘做一份国内备用链接放进 `links`；等有自动更新需求再上对象存储。无论哪种，都要保留 GitHub 原始链接和 `.sha256`，方便用户校验。

---

## 11. 简单下载 Windows 网站更新清单（0.2.1 接入）

2026-10-18 用户明确授权正式发布最新 Windows 0.2.1 安装包、更新清单与网站下载入口，覆盖此前“仅交付本地安装包”的范围。当前分发标识为 `20261018T152358Z-ede0cc5e`，MCP 组件随包；Android 发布流程不变。提交与附件上传不替代部署后的线上核对。

2026-10-20 的 Windows **0.2.11** 发布沿用本节流程，新增下述已实测兼容映射；上段及下方 0.2.1 值保留为初次接入记录。GitHub 将本次中文安装包资产名规范化为 `-0.2.11.exe`，随后通过 API PATCH 中文 `name` 仍无法保留，中文 `label` 可以保留。因此本次本地安装包、ZIP 及 ZIP 内安装程序仍为 `简单下载-0.2.11` 对应后缀；远程安装资产使用 `SimpleDownload-0.2.11-Windows-Setup.exe`，ZIP 使用 `SimpleDownload-0.2.11.zip`，配中文 label。网站 `releaseAssets` 显式记录实际远程 `fileName`、中文 `displayName`、固定 URL、大小及摘要，下载按钮显示中文名称并链接真实 ASCII 地址，不能构造不存在的中文 URL。

已发布 0.2.1 客户端拒绝带版本中文 `fileName` 或新增清单字段，故正式 `latest.json` 仍保留原 15 字段与 `fileName=简单下载.exe`，指向同一 tag 的 `SimpleDownload-0.2.11-Windows-Setup.exe`。网站 `installer` 与 `legacyInstaller` 共用该安装资产，无需重复上传相同文件。生成清单使用产品脚本的 `-LegacyClientCompatibility`；网站测试要求两个角色的 URL、fileName、displayName、size、sha256 完全一致且同 releaseId，资产核验按实际远程文件去重，ZIP 单独核验。最终仍需真实旧／新客户端与匿名下载验证；文件映射通过不替代发布或部署成功。

本次实际 releaseId 为 `20261020T083459Z-4689b1da`，GitHub Release `418168496` 于 `2026-10-20T09:09:14Z` 公开；固定 tag 为 `simple-download-windows-v0.2.11-20261020T083459Z-4689b1da`。安装资产 `658746018` 为 201574269 字节，ZIP 资产 `658799148` 为 195397509 字节，两个资产 label 均为对应中文版本名，附有 `SHA256SUMS.txt`。这些 API 事实不替代匿名完整下载、网站部署或本机安装验收。

- 固定入口：`https://springhues.com/updates/simple-download-windows/latest.json`。只发布已验证的真实安装包清单，不放占位清单；客户端在缺少清单时显示“更新服务尚未上线”。
- 清单 schemaVersion=1，appId=`simple-download-windows`，channel=`stable`，platform=`windows`，architecture=`x64`。软件 version 由用户指定，目前为 `0.2.1`。
- 每次打包前生成独立 `releaseId` 和 UTC `releaseCreatedAtUtc`，随安装载荷保存 `release-info.json`。同版新分发也可更新，软件版本不加后缀；旧版本、旧分发不降级。
- tag 使用 `simple-download-windows-v<version>-<releaseId>`；附件仍用 ASCII `SimpleDownload-<version>-Windows-Setup.exe`。不同分发使用不同 tag，不覆盖旧附件，不使用共用仓库的 `latest`。
- `installerUrl` 指向本人 `Lacr1me/springhues-releases` 的固定 tag 附件；`fileName` 为 `简单下载.exe`；`size` 和 `sha256` 来自最终安装包。`releasePageUrl` 必须是相同 tag，`publishedAtUtc` 是实际公开时间，`notes` 为简短更新说明。
- 软件只在主动检查／下载时重新获取清单；下载固定单一快照并校验大小与 SHA-256。用户点击“安装更新”才安全暂停并写入恢复状态，退出后由现有安装器升级。

每次发布顺序：
1. 在简单下载项目中完成打包，运行 `desktop/tools/write-update-manifest.ps1 -InstallerPath <包> -ReleaseInfoPath <载荷身份> -OutputPath <release-plan.json> -PrepareOnly`，生成带真实字节数和校验值的未发布准备文件。该文件不部署。
2. 作为独立发布动作上传不可变 tag 附件与校验文件；确认匿名可下载、实际大小和 SHA-256 与本地一致，保留旧附件。
3. 使用真实 `-PublishedAtUtc` 生成正式清单，放到 `updates/simple-download-windows/latest.json`；同次更新 `site/works.json` 的 Windows version、updatedAt、下载链接与发布页，二者必须指向同一包。上传失败不得修改正式清单。
4. 运行 `node scripts/test-software-updates.mjs --require-manifest`，随后沿第 6 节完整验证、提交和部署；构建白名单包含 `updates`，禁止手改 dist。此测试自带小型隔离构建验证，不读写日报状态。
5. 部署后重新读取线上清单，核对匿名附件链、大小、校验值；只有两者均可用才记为网站更新链路已交付。

有活动日报 lease 时保留网站工作树与 dist，只在软件项目隔离目录准备 patch；不得获取或释放别人的租约、启动日报制作、修改日报正文或一并提交其他未提交内容。

---
## 12. 已知问题与待办（按紧急程度）

1. **归档保留窗口「每个频道只保留最近 7 期」——已实施（2026-10-17）**。
   - 规则：游戏日报、民生日报各自取索引里按日期倒序的前 7 个日期（不假设日期连续）。更早期次的索引条目、正文 JSON、公开 PNG（`downloads/<频道>/<日期>.png`）以及只被这些旧期次引用的 `game-brief-assets/` 配图一起移除；被保留期次、其它页面或 `data/.pending` 草稿引用的配图一律保留。旧内容只留在 git 历史里（需要时用 `git show <提交>:<路径>` 或 `git checkout <提交> -- <路径>` 取回），**没有重写历史**，GitHub 上显示的仓库体积不会因此变小，缩小的是发布出去的站点（Pages 上限 1 GB）。
   - 命令：`node scripts/prune-archive.mjs`（默认 dry-run，只打印将移除的内容、数量和体积）；确认后加 `--apply`（用 `git rm` 删除受跟踪文件、只过滤索引条目、并自动重跑 `scripts/build-embedded.mjs`）。可选 `--keep=7`、`--channel=game|minsheng|both`。重复运行无副作用；索引与文件不一致（如索引有条目但 PNG 缺失）会逐条提示。脚本**只处理受 git 跟踪的文件，绝不删除未跟踪文件**。
   - 结果（2026-10-17 实施前后）：游戏日报索引 55 期 → 7 期（2026-10-10～2026-10-17；10-16 本就没有期次），民生日报 57 期 → 7 期（2026-10-11～2026-10-17）。`downloads/game` 55 张 473.9 MB → 7 张 64.6 MB；`downloads/minsheng` 57 张 111.5 MB → 7 张 16.0 MB；`game-brief-assets` 受跟踪文件 3426 个 418.4 MB → 483 个 91.3 MB；共 `git rm` 3139 个文件（约 834 MB）。本地 `dist/` 由 758.8 MB 降到 210.8 MB（本地构建会把未跟踪配图一并复制，CI 上更小）。
   - 未跟踪旧图：`game-brief-assets/` 里有 184 个未跟踪的旧日期图片（约 14.4 MB）不在 git 里，删了无法恢复，脚本一律不动，只在 dry-run 里提示数量。作者确认不再需要后可手动删除；同时 `offline-homepage-editor/`、`output/` 等其它未跟踪内容也未触碰。
   - 每日衔接：**每次发布成功后运行 `node scripts/prune-archive.mjs --apply` 并随该期提交**（顺序见 `docs/daily-runbook.md`「归档保留窗口」）。没有自动接进发布脚本：发布事务的日志按索引前后哈希判断能否恢复，事务外改索引会让同日重跑报 `PUBLISH_CONFLICT`。
   - 连带改动：① 首页计数器的标签由「简报期数」改为「近期简报」（它统计两个索引当前的期数之和，归档只剩 7 期后不再是历史累计）；② `scripts/check-daily-backlog.mjs` 把早于频道最早在档期次的日期视为已按窗口移除，不再当作历史缺口；③ 原先直接读 `data/` 里 2026-08～09 旧期次的测试，改读固定夹具 `scripts/fixtures/archive-seed/`（真实期次的副本，另由 `scripts/state-evidence-fixtures.mjs` 的 `archiveSeedRoot` / `materializeArchiveSeed` 提供），以后清理不会再弄坏这些测试；`scripts/test-health-browser.mjs` 改为取各频道索引里最新两期。新增 `scripts/test-prune-archive.mjs`，已挂进 `test-daily-operations.mjs`，CI 会跑。
   - 注意：`test-site.mjs`、`verify-build.mjs` 对索引里每一期检查 PNG 是有效 PNG，所以**仍然不能只删图或只改索引**；一律用上面的脚本。`data/embedded.js` 仍由 `build-embedded.mjs` 生成，禁止手改。
2. `scripts/verify-home-redesign.mjs` 里的旧占位 slug 需要更新（见第 7 节）。
3. 国内镜像未做（第 10 节）；Windows 更新客户端与清单契约已纳入 0.2.1，本地准备与线上发布状态按第 11 节分别核验。
3a. **网站本体在国内访问卡（作者已提出，尚未选方案）**：站点在 GitHub Pages，GitHub 没有中国大陆节点，国内访问不稳定。下面是评估，不是事实，动手前先用国内测速站（如 boce、17ce、itdog）实测现状和候选方案：
   - 公开的对比测评（2024 年，较旧，需复测）认为：GitHub Pages 国内不稳定；Cloudflare Pages 国内延迟高（回源海外）；Vercel 国内较好但平台默认域名常被墙、必须绑自有域名，免费档有体积等限制；腾讯云 EdgeOne Pages 国内最好，其「国内站」需要 ICP 备案，「国际站」免备案但国内只能算「还行」。
   - 候选：① 国内对象存储 + CDN（阿里云 OSS、腾讯云 COS、七牛等），最稳，但域名在国内服务必须 ICP 备案（周期约数天到数周，未核实），需要账号和费用；② EdgeOne Pages 国际站，免备案、改动小，速度中等；③ 海外或香港轻量服务器自己跑 Nginx，国内访问取决于线路，要运维；④ 在 GitHub Pages 前面加 Cloudflare 免费 CDN，国内收益有限，不推荐作为主方案。
   - 通用接法：GitHub 仍是源码仓库和备份；`pages.yml` 里构建出 `dist/` 后，再多一步把同一份 `dist/` 同步到新平台（密钥放 GitHub Secrets，**绝不写进仓库**）；DNS 用支持「分线路解析」的服务（DNSPod、阿里云解析等），国内线路指向国内托管，海外线路仍指 GitHub Pages。改 `.github/workflows/` 属于高风险改动，必须先征得作者同意。
   - **作者已回答（2026-10-17）**：域名 `springhues.com` 在**阿里云**购买（一年期，需注意到期续费，DNS 默认在阿里云云解析）；**不想备案**；用户主要在**中国大陆**。结论：没有备案就用不了大陆节点，上限是「香港/海外节点 + 较好线路」，会比 GitHub 直连稳，但不如备案后的大陆 CDN。
   - 腾讯云官方文档（已查）：未 ICP 备案的域名在 EdgeOne 里**只能选「全球可用区（不含中国大陆）」**；「中国大陆网络优化（国际加速）」仅企业版提供。所以不备案时不要指望大陆节点。EdgeOne 个人版套餐的价格和免费额度以官网为准（页面上看到最低约每月 1.4 美元，**未核实**）。
   - **推荐的最小改动路径（待验证，需要作者开通腾讯云账号）**：把 EdgeOne 当 CDN 放在现有 GitHub Pages 前面，**源站就是 GitHub Pages，不改部署流水线**。步骤：① 先用测试子域名（如 `test.springhues.com`）在 EdgeOne 添加站点，加速区域选「全球可用区（不含中国大陆）」，源站指向 GitHub Pages，在阿里云云解析里把子域名 CNAME 到 EdgeOne；② 用国内测速站对比 `springhues.com` 与 `test.springhues.com`；③ 效果好再把主域名切过去，GitHub Pages 保留为源站和备份；④ 之后可以在 `pages.yml` 部署成功后加一步缓存刷新（需要密钥，放 GitHub Secrets，改 workflow 前先征得作者同意）。
   - 这条路径要验证的风险：GitHub Pages 作为源站时要带正确的 Host 头；主域名不再直接指向 GitHub 后，GitHub 自动续期 HTTPS 证书是否受影响（先在测试子域名上观察）；EdgeOne 缓存让新版延迟生效，HTML 要设短缓存或在部署后刷新。
   - 备选：Vercel + 自有域名（国内通常可用，但平台默认域名常被墙，访问质量会波动，免费档有限制）；以后改主意愿意备案，则走大陆对象存储 + CDN，是最稳的。
   - 站点本体并不重：首页脚本约 120 KB、首屏图几百 KB；真正的大文件是 3840px 的日报 PNG（单张约 8 MB，只在点下载时才加载）。
4. 卡片没有配图；网页设计已有专属「浏览器」载体（`site/js/carriers/browser.js`），Mod / 游戏仍在用通用「碎片卡」，专属载体（Mod 补丁碎片或卡带、游戏光盘或卡带）未做。
5. `docs/personal-site.md` 与 `AGENTS.md` 的目录表已按新结构更新，但 `README.md` 仍是旧描述，仅供追溯。
6. 隐私页（`privacy/index.html`）开头写「最后更新：2026 年 10 月 17 日」。以后只要改动涉及留言或浏览器本地存储的行为，必须同步改隐私页内容和这个日期，并跑 `node scripts/test-messages.mjs`。首页现在写入三个本地键：`springhues.home.theme`、`springhues.home.introAt`、`springhues.home.introSeen`（隐私页已列出）。
7. 首页文案（作品区导语、关于区三段、页脚）是 AI 按作者的作品介绍代写的。第二段「目前的软件都以本地处理为先……」是依据两个软件的介绍概括的，作者尚未逐字确认。
8. 窄屏（360–430px）下 Windows 窗口卡的标题栏文件名与控件点、NEW 角标会有些拥挤（不影响使用）。
9. 游戏日报页日间首屏蓝色占比约 29.8%，略低于 30%：日报纸面保持冷白是有意取舍，规范里列为例外。
10. 清理项：`.worktrees/site-redesign` 与分支 `feat/site-redesign` 已合并进 `main`，内含约 95 MB 的设计草稿 `.agents/`（设计 / 评审 / 截图 / 日志）。作者说先留着；确认不再需要后：`git worktree remove --force .worktrees/site-redesign` 再 `git branch -d feat/site-redesign`。**`.worktrees/` 下其它目录（`task-b-*`、`task-c-*`）属于日报自动化，不要动。**
11. 首屏主视觉原图 `assets/hero/风格化.jpeg`（5 MB）只在本地，被 `.gitignore` 忽略，也不会进 `dist/`；作者另有备份 `D:\下载\风格化.jpeg`。重新生成网页尺寸：`node scripts/build-hero-assets.mjs`（`--check` 只校验现有产物，`--palette` 输出取样色）。
12. 真机验证缺口：动画手感、真实 GPU、真实手机、Safari、Firefox、读屏软件，都没有测过；开场动画「完整版」约 2.5 秒，嫌长可改 `site/js/loader/loader.js` 的时间线。

---

## 13. 历史决策（避免重复讨论）

- 首页从「侧边栏资源库」重做为无侧边栏的 SHARD 单页；配色取样自作者唯一的参考图（蓝 `#0537B4`、红 `#90072A`），而不是标准克莱因蓝 `#002FA7`。
- 分类从 7 个精简为 4 个 + 「全部」，对应作者旧站的分类（软件工具 / 网页设计 / 游戏资源）外加「每日简报」；平台（Android / Windows / Mod）改作标签，不再是筛选项。
- 移除了第三方动画库，改为原生实现。原因：它的许可不是 MIT，作者不想为此费心，且包体积占 vendor 的 88%。**不要重新引入**。
- 不使用截图做卡片图：作者认为没有风格化的配图时直接放截图显得粗糙，决定等有统一风格的图再放（基础设施已就绪，见第 4 节）。
- 切换分类曾出现「作品墙高度瞬间塌成 0 再弹开」，已用「钉住旧高度 → 连续补间到新高度」修复，相关连续性检查在 `verify-home-redesign.mjs` 的 `filter` 分区，不要削弱。
- 首屏已去掉鼠标驱动的波纹，只保留随时间的缓慢流动；红色刃光角度固定。
- 子页面与首页同风格，但不加载首页专属的 WebGL / 开场动画；`site-shell.js`、`brand.css` 因被日报导出和后台共用而保持原样。
- 软件安装包放独立仓库的 Releases，不进网站仓库。

---

## 14. 给 AI 的提示词模板（可直接复制）

**A. 新增一个软件作品并发布**
> 先读 `docs/HANDOFF.md`（第 4、5、6 节）。我有一个新软件：名称 / 简介 / 平台 / 版本 / 更新日期 / 本地安装包路径 如下：……。请：1) 按第 5 节把安装包以 ASCII 文件名传到 `Lacr1me/springhues-releases` 的新 Release（附 .sha256，并核对 digest）；2) 在 `site/works.json` 新增作品（卡片简介 ≤120 字，长介绍放 `details`，下载链接用带 tag 的直链，另加「发布页与校验值」）；3) 跑第 6 节的测试；4) 只暂存自己改的文件并提交，推送前先问我。

**B. 发布已有软件的新版本**
> 先读 `docs/HANDOFF.md` 第 5、6 节。把 `<软件名>` 的新版本 `<版本>`（安装包在 `<路径>`）按第 5 节发布为新 Release，更新 `site/works.json` 里该作品的 `version`、`updatedAt` 和下载链接，跑测试，提交，推送前问我。

**C. 把一个页面改成站点风格**
> 先读 `docs/shard-style.md` 和 `site/css/shard-theme.css`，再把 `<页面路径>` 改成 SHARD 风格（或按 `docs/shard-style-prompt.txt` 的提示词执行）。不得修改日报导出消费的文件；完成后运行 `node scripts/check-shard-style.mjs` 与 `node scripts/test-site.mjs`。

**D. 添加国内镜像**
> 先读 `docs/HANDOFF.md` 第 10 节。我已经在 `<镜像地址>` 放好了 `<文件>`。请在 `site/works.json` 对应作品的 `links` 里加一条「国内镜像下载」，保留 GitHub 原始链接，跑测试并提交，推送前问我。

**E. 排查「线上和本地不一样」**
> 先读 `docs/HANDOFF.md` 第 6、12 节。用 `gh run list` 看最近一次部署是否成功；检查 `scripts/build-site.mjs` 的白名单是否包含新文件；再看是否是 10 分钟缓存或 `?v=` 版本戳不一致造成。

**F. 清理旧归档（每次日报发布成功后）**
> 先读 `docs/HANDOFF.md` 第 12 节第 1 条和 `docs/daily-runbook.md` 的「归档保留窗口」。先运行 `node scripts/prune-archive.mjs` 看 dry-run 报告（每频道应只剩最近 7 期，不得出现未跟踪文件被删），确认后加 `--apply`；再跑 `node scripts/test-site.mjs`、`node scripts/build-site.mjs`、`node scripts/verify-build.mjs`；用 `git status --short` 确认暂存区只含本次发布文件和清理产生的删除，只按路径暂存并提交，推送前问我。不要手工删 `downloads/`、`game-brief-assets/`，也不要动未跟踪文件。
---

## 15. 常见坑（这台机器上踩过的）

- **git 连不上 GitHub（`push` / `fetch` 报 `Failed to connect to github.com:443` 或 `Connection was reset`）**：作者的电脑在 Windows 系统里开了本地代理 `127.0.0.1:7897`（可用 `Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'` 查看 `ProxyServer`），浏览器、PowerShell 的 `Invoke-WebRequest`、`gh` 会走它，但 **git 默认不走**，直连不稳定。解决：每条 git 联网命令临时加 `-c http.proxy=http://127.0.0.1:7897`，例如 `git -c http.proxy=http://127.0.0.1:7897 push origin main`、`git -c http.proxy=http://127.0.0.1:7897 fetch origin`。**不要用 `git config` 写入全局配置**（那会悄悄改变作者的环境）。代理端口以注册表里的实际值为准，可能变化；代理软件没开时这条也会失败，先让作者打开代理。
- **PowerShell 工具有时会吞掉后续输出**（尤其是 `Start-Process -NoNewWindow` 启动浏览器或长任务之后）。做法：把输出重定向到文件再读取；或单独再发一条命令查看结果。
- 不要把自定义函数命名为 `R`：它是 `Invoke-History` 的别名，会报「找不到接受自变量的位置参数」。
- 不要用 `-F -` 加 here-string 当提交信息；用 `$msg = @'...'@; git commit -m $msg`。
- 路径含中文和空格（`F:\Codex-App\MC mods\…`），一律用 `-LiteralPath` 并加引号。
- `git` 提示 `LF will be replaced by CRLF` 是 `core.autocrlf=true` 的正常提示，不是错误。恢复文件内容时用 `git show HEAD:path` 的原始字节，别用 `Set-Content` 管道改编码。
- `git status` 在主目录会提示 `${CODEX_PROJECT_DIR-./` 目录打不开，这是历史遗留的异常目录名，可忽略。
- GitHub 附件名里的中文会被改写，所以附件一律 ASCII。
- 文档里不要写已移除的第三方动画库的名字（`test-home.mjs` 会扫 `docs/` 并报错）。
- 改了 `site/css` 里的颜色属性，不要用命名色（`red`、`blue`……），也不要在 `pages-messages.css`、`pages-privacy.css` 里写十六进制色值，检查脚本会报错。
- 在主目录运行 `build-site.mjs` 会重建 `dist/`；日报制作进行中不要运行。

---

## 16. 交付状态快照

- 本文随提交 “Add real works, download links and handoff docs” 一起提交；之后的变更以 `git log` 为准。读到本文时先用 `git status` 与 `git log origin/main..HEAD` 确认本地是否有未推送的提交。
- 三个发布仓库里已有的 Release 见第 1 节表格；`springhues-web` 暂无内容。
- 已验证：首页单测、`test-site`、`check-shard-style`、隔离环境下的 `build-site` + `verify-build`（图片接入前的版本）、三个下载直链的匿名访问与 SHA-256 一致性、Edge 下首页与详情页无控制台错误。未验证：真机手感、真实下载安装、国内网络下的下载速度。
