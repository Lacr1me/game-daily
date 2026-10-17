# 第二轮收尾报告（REPORT-v2）

范围：worktree `f:\Codex-App\日报设计\.worktrees\site-redesign`（分支 feat/site-redesign）。全部改动未 commit / push / merge。
依据：plan-v2.md、task-round2/features/FEAT-001~003.json 的 findings、review-v2.json（APPROVED，仅 4 条 LOW）、verification.md「第二轮」小节，以及 `git status --short` / `git diff --stat` 的核对。

## 1. 三项改动

### A. 切换分类不丝滑（FEAT-002）
- 现象：点击作品分类时，作品墙先塌到 0 高度再弹开，下方字幕条和「关于」跟着突然上窜再下弹（对应用户视频）。
- 根因：`site/js/wall/filter.js` 里 `Flip.from(state, { absolute: true })` 会把全部 `.slot` 临时改成 `position:absolute`。它们是网格容器 `.wall` 的子元素，脱离文档流后 `.wall` 高度塌成 0。动画结束后还原定位，墙高又瞬间跳到新高度，所以出现“先塌后弹”两次突变。
- 修改前复现数据（Playwright + Edge，rAF 逐帧采样）：
  - 桌面 1440×900，全部(14)→安卓(3)：墙高 2646 → **0** → 803；`#about` 顶 3070 → 424 → 1227。
  - 桌面 安卓(3)→日报(2)：803 → 0 → 598。
  - 手机 390×844：1061 → 0 → 246。
  - 动画结束时常驻卡有约 34px 的视差跳变（250 → 216）。
- 修法：新增 `site/js/wall/morph.js`。Flip 前先钉住旧墙高，同时用独立 tween 把高度补间到新高度，结束后清内联高度。保留 Flip 的卡片飞行效果。
  - 连点可中断，以最后一次为准。
  - 动画结束只做一次 `ScrollTrigger.refresh()`，并用 WAAPI `translate` 做 420ms 的视差结算缓动，消除 34px 瞬跳。
  - 去掉 reduced-motion / 无 GSAP 路径上的 150ms 透明度闪烁，改为一步到位。
  - 动画结束清掉 `opacity` 内联样式，避免被隐藏卡之后走即时路径时透明。
  - `.wall` 加 `overflow-anchor:none`，补间期间加 `is-morphing` 的 clip-path 裁切，避免进出场卡压到字幕条。
- 与计划的偏差：`PEAK_SLOPE` 由 3 改为 4。GSAP power3.inOut 中点斜率是 32x³=4，用 3 在 17ms 帧上会误报。验收脚本与模块同源导入该常量，没有放宽标准。

### B. 作品分类精简（FEAT-001）
- 筛选栏变为 5 项：全部资源（代码提供）、软件工具、网页设计、游戏资源、每日简报。作品数 14 / 6 / 2 / 4 / 2。
- 14 条作品的 slug 全部不变，因此旧的 `?work=` / `#work=` 链接仍有效。
- 载体按作品指定：Android 作品 `phone`，Windows 作品 `window`，日报 `page`，网页和游戏 `shard`。四种载体仍都在墙上可见。
- 新增可选字段 `platform`（≤16 字），用于卡面小字、详情「平台」行和命令面板搜索。
- 旧链接别名放在新文件 `site/js/core/category.js`：`#cat=android|windows` → software，`#cat=mod` → game，未知值 → all。地址栏即使在静默路由下也会被改写为规范值。
- 文案同步：菜单「每日简报」、字幕条、说明、关于、meta description、计数器「简报期数」。
- 窄屏下芯片栏可横向滑动，选中芯片自动滚入可见区，页面本身不产生横向滚动。

### C. 去掉鼠标波纹、保留流动（FEAT-003）
- 删除 `uMouse` / `uVel` / `uAspect` 及整段涟漪着色器代码。
- 删除 `hero.js` 里 WebGL 分支的 pointermove、lerp 和 vel 衰减。
- 刀光角度固定为 0.62，不再跟随鼠标。
- 保留时间驱动的布料位移、窗格光影、昼夜混合。流动参数未改（位移幅度 0.0055），实测静止时仍有明显流动。

## 2. 文件清单
整个 worktree 尚未提交，`git status` 里 `site/` 等目录整体显示为未跟踪。下面按第二轮实际触及的文件列出，来源是 plan-v2 与各 FEAT 的 findings。

新增：
- `site/js/core/category.js`
- `site/js/wall/morph.js`
- `.agents/tasks/site-redesign/` 下的 plan-v2.md、review-v2.json、task-round2/、本报告

修改（第二轮触及）：
- `site/works.json`
- `site/js/data/works.js`
- `site/js/wall/filter.js`
- `site/js/wall/render-basic.js`
- `site/js/wall/detail.js`
- `site/js/carriers/phone.js`、`shard.js`、`window.js`
- `site/css/carriers.css`、`site/css/wall.css`
- `site/js/ui/palette.js`
- `site/js/hero/shaders.js`、`webgl.js`、`hero.js`
- `index.html`（文案，CSS 与 main.js 的 `?v=` 升到 `20261017-shard-v2`）
- `scripts/test-home.mjs`、`scripts/verify-home-redesign.mjs`
- `.agents/tasks/site-redesign/REPORT.md`、`verification.md`

已跟踪文件的 diff（`git diff --stat`）：12 个文件，+385 / −91，都是第一阶段的改动：`.gitignore`、`THIRD-PARTY-NOTICES.txt`、`docs/personal-site.md`、`index.html`、`portal-data.js`、`privacy/index.html`、`scripts/build-site.mjs`、`serve.mjs`、`test-messages.mjs`、`test-portal-data.mjs`、`test-site.mjs`、`verify-build.mjs`。

没有触碰：`game/`、`minsheng/`、`messages/`、`admin/`、`supabase/`、`data/`、`downloads/`、`artifacts/`、`config/`、`.github/`，也没有手改 `dist/` 或 `data/embedded.js`。`dist` 不存在。

## 3. 已实际运行的验证（来自 verification.md 第二轮 6.2，以及我这次的核对）

| 命令 | 结果 |
| --- | --- |
| `node scripts/test-site.mjs` | 退出码 0；首页单测 16 组全过 |
| `node scripts/test-portal-data.mjs` | 通过（8 项） |
| `node scripts/test-messages.mjs`、`test-admin-logs.mjs`、`test-daily-operations.mjs` | 退出码 0 |
| `node --test scripts/test-collect-live-page-evidence.mjs` | 退出码 0 |
| `node scripts/build-hero-assets.mjs --check` | 退出码 0 |
| `node scripts/verify-home-redesign.mjs --section=all` | 48/48 通过（第一阶段 37 + 本轮新增 11） |
| `node scripts/build-site.mjs` → `node scripts/verify-build.mjs` | 均退出码 0；运行前确认 dist 不存在，跑完已删除 |
| `git diff --check` | 退出码 0，仅 CRLF 提示 |

修改前基线：filter 分区在未改 filter.js 时 1/7 通过。桌面和手机墙高塌陷到 0，两条降级路径检出 opacity 0.4 闪烁。

filter 分区真实数值（swiftshader，rAF 采样）：
- 桌面 1440×900：最小墙高 394（网页 2 项的目标高度，从未低于 min(旧,新)−2）。最大相邻帧位移比 0.95。关于区与墙底间距极差 0。`#filters` 顶极差 0。每次切换 `ScrollTrigger.refresh` 恰好 1 次。快速连点 5 次墙高 394–2953，位移比 0.92–0.94，终态与最后一次点击一致。结算窗口内常驻卡单帧最大位移 34.9px，在结算缓动斜率上界内。
- 手机 390×844：最小墙高 94。位移比 1.06（findings 中记录为 1.15，以 1.15 上界内为准）。间距极差 0。refresh 0 次（lite 无视差）。快速连点位移比 0.93–0.96。
- reduced-motion 与 GSAP 404：墙高序列只有旧→新两个值，无 0、无 opacity<1 采样。popstate 后 14 张卡 opacity 均为 1。
- hero：鼠标静止与移动两阶段，除 uTime 外 uniform 取值集合一致。GL 不再查询 uMouse/uVel。鼠标不动、间隔 1.5s 的首屏像素差 18.2–18.6%（阈值 9%）。

读图确认的截图在 `.agents/tasks/site-redesign/screenshots/`：
- `filter/mid-*.png`：补间中间帧，无卡片压到字幕条。
- `wall/wall-1440x900.png`
- `responsive/wall-390.png`
- `hero/webgl-day.png`、`webgl-night.png`

review-v2：APPROVED，无 HIGH/MEDIUM，4 条 LOW（见下一节）。

## 4. 未验证项与局限
- 真机 60fps / 真实 GPU 下“丝滑”的主观感受没验证。环境是 swiftshader 软渲染 + Edge，只用帧间位移的斜率上界做客观断言。需要用户在真机上主观确认。
- 真实手机、Safari、Firefox 未测。`translate` 属性在老浏览器（Safari <14.1）不支持时，结算缓动会失效，退回瞬跳，不报错。
- 补间进行中窗口 resize 的极端情形未专测。
- 即时路径（popstate / hashchange）恰好落在一次补间进行中时，墙高可能有一次跳变（review LOW，未专测）。可选修法是给 morph 加 `cancel()`。
- 部署后约 10 分钟内，浏览器若缓存了旧的 `hero.js` / `webgl.js` / `shaders.js` 并与新版混用，可能出现一次性异常画面（NaN uniform）。这三个文件无版本戳，按计划风险 8 接受。零风险做法是改文件名或给 import 加 `?v=`。
- `.wall.is-morphing` 的 clip-path 下沿只留 16px，补间中卡片阴影在墙底可能被裁一点（review LOW，目检未见问题）。需要时放宽到 −28px。
- 视频 `QQ20261017-085912.mp4` 只用 Edge 抽帧确认了现象，没有逐帧量化。
- 同类细节：window 载体在 FEAT-001 的三张截图里没有目视，由 EXPECT_CARRIER 断言覆盖。
- 390 宽下芯片栏首屏只露出 2 个芯片，靠横向滑动，属预期。

## 5. 请用户确认的假设
1. lite 档（触屏 / 窄屏）在 GSAP 可用时仍保留作品墙补间。理由是手机是你明确要求平滑的场景。若希望触屏也不动画，改 `filter.js` 里 `canMorph` 条件一行。
2. `software` 分类缺省载体为 `window`。Android 作品显式写 `carrier:"phone"`；web / game 默认 `shard`；daily 默认 `page`。以后新增软件作品忘写 carrier 会显示成窗口样式。
3. 降级分支（无 WebGL、触屏、reduced-motion 的静态首屏）的 CSS 径向红光仍随鼠标移动。这不是涟漪，按“静态回退行为不变”保留。要连它也去掉请告知。
4. 首屏计数器“分类”显示 **4**（统计有作品的分类，不含代码提供的“全部资源”）。
5. 计数器标签由“日报期数”改名“简报期数”，与分类名“每日简报”保持一致。频道名“游戏日报 / 民生日报”不动。
6. 部署后短暂缓存混用窗口（上文第 4 节）接受不处理，还是给首屏三个模块加版本戳。

## 6. 预览方式
- 你现有的 `127.0.0.1:4173` 预览服务器实时读文件，没有停过，直接刷新即可看到第二轮效果。
- 作品墙切换：点芯片。
- 旧链接别名：打开 `/#cat=android`，应自动变为 `#cat=software` 并选中“软件工具”；`/#cat=mod` 变为 `#cat=game`。
- 首屏：移动鼠标应不再有波纹，画面仍随时间缓慢流动。
