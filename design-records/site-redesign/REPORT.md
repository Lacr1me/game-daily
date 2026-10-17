# Springhues 首页重做（SHARD）最终报告

分支 `feat/site-redesign`（基于 main 40accd0），worktree：`f:\Codex-App\日报设计\.worktrees\site-redesign`。全部改动未提交、未合并、未推送。评审结论：APPROVED（无阻断项）。

## 1. 文件清单

改动（M）：`.gitignore`、`THIRD-PARTY-NOTICES.txt`、`docs/personal-site.md`、`index.html`（重写为 SHARD 单页）、`portal-data.js`（新增 `publishedEditions`）、`privacy/index.html`、`scripts/build-site.mjs`、`scripts/serve.mjs`、`scripts/test-messages.mjs`、`scripts/test-portal-data.mjs`、`scripts/test-site.mjs`、`scripts/verify-build.mjs`。

新增（??）：
- `site/css/*`（11 个样式）、`site/js/**`（core / hero / loader / wall / carriers / ui / data 模块，入口 `main.js`）、`site/works.json`（作品清单）
- `assets/hero/web/*`（主视觉衍生图 jpg/webp）、`assets/fonts/anton-latin.woff2`
- `vendor/gsap/*`、`vendor/lenis/lenis.min.js`
- `scripts/build-hero-assets.mjs`、`scripts/color-family.mjs`、`scripts/test-home.mjs`、`scripts/verify-home-redesign.mjs`
- `.agents/`（任务记录、截图、日志，不应入库，合并前请确认是否排除）

未改：`game/`、`minsheng/`、`messages/`、`admin/`、`supabase/`、`.github/workflows/`、`dist/`、`data/`。

## 2. 本地预览（pwsh）

```powershell
cd "f:\Codex-App\日报设计\.worktrees\site-redesign"
$env:PORT = 4173; node scripts/serve.mjs
# 浏览器打开 http://127.0.0.1:4173
```

可选检查：

```powershell
node scripts/test-site.mjs
node scripts/verify-home-redesign.mjs --section=all   # 需本机 Edge
node scripts/build-site.mjs; node scripts/verify-build.mjs   # 生成 dist，看完可删
```

## 3. 验证情况

已验证（实际运行，退出码 0）：`test-portal-data`、`test-site`（含 14 组首页单测）、`test-messages`、`test-admin-logs`、`test-daily-operations`、`test-collect-live-page-evidence`、`build-hero-assets --check`、`build-site` → `verify-build`、`verify-home-redesign --section=all`（37/37，Edge 无头）、`git diff --check`（仅 CRLF 提示）。
浏览器验收覆盖：加载器四模式与跳过、旧链接 `?view=`/`?work=` 兼容、`?date=` 改写与未来 publishAt 回退、键盘与命令面板、主题切换、8 个宽度无横向滚动、逐级降级（无 WebGL / 无 GSAP / `works.json` 404 / `main.js` 404 / 禁 JS）、零非同源请求、admin 不入公开导航。

未验证 / 局限：
- 动效（视差、Flip 开合、擦除转场、光标、WebGL 视差）只在静态帧与状态断言层面验证，没有量化帧率，没有录屏逐帧检查流畅度；只触发过 20× CPU 节流下的降级逻辑。"丝滑"这一项需要你在真机上自己看。
- WebGL 用 swiftshader 软渲染测，非真实 GPU；真实手机 / 平板、Safari、Firefox 未测。
- LCP / CLS 等性能指标未测，仅量了 gzip 体积（自写 JS 50.3KB、CSS 18.9KB，在预算内）。
- 线上部署与 GitHub Pages 缓存未验证；`pages.yml` 未改也未跑。
- 读屏与完整 WCAG 合规需要人工和专家复核；运行中切换 reduced-motion 的实时销毁未专测。
- 昼间全页蓝占比约 50.5%，低于设计目标约 60%（夜间 78.5%），仅记录。

## 4. 引入的 vendor / 资源体积（未压缩）

| 文件 | 字节 |
| --- | --- |
| vendor/gsap/gsap.min.js | 72,435 |
| vendor/gsap/ScrollTrigger.min.js | 44,157 |
| vendor/gsap/Flip.min.js | 25,013 |
| vendor/lenis/lenis.min.js | 18,815 |
| assets/fonts/anton-latin.woff2 | 18,612 |

vendor 合计约 160KB（gzip 约 61KB）。主视觉衍生图 `assets/hero/web/`：jpg/webp 共 7 个尺寸，最大 hero-2560.jpg 524KB；`dist/assets` 合计 3.25MB，无 >1MB 文件。原图 `assets/hero/风格化.jpeg`（5.0MB）被 `.gitignore` 忽略，且 `verify-build` 拒绝其进入 dist。哈希见 `THIRD-PARTY-NOTICES.txt`。

## 5. 待决策项

GSAP 许可（单列，请确认）：
- GSAP 3.13.0 使用 GSAP Standard "no charge" License（https://gsap.com/standard-license/），不是 MIT / OSI 许可。
- 网站（含商用）可免费使用；但不得把 GSAP 用于与 Webflow 类可视化动画构建工具竞争的产品。个人作品站一般不触及此限制。
- 我只据 `THIRD-PARTY-NOTICES.txt` 的摘要整理，没有做法律判断；请你读原文后确认。
- 若不接受：Flip 路径可改用 View Transitions（已有降级路径），视差与筛选动画需自写。Lenis 为 MIT，Anton 为 OFL，Lucide/Feather 为 ISC/MIT，均无此问题。

其他：
1. 隐私页：已删除过期的"资源收藏"段，改为"浏览器本地偏好与搜索"，列出 `springhues.home.theme / introAt / introSeen`。"最后更新"日期未改，等你决定。
2. AGENTS.md 与 docs 同步：AGENTS.md 目录入口仍描述旧门户（`portal.css`、`portal.js`）。`docs/personal-site.md` 已改，但按 AGENTS.md 属于规则文档，是否同步需你批准；本次未改 AGENTS.md。
3. 旧文件去留：`home.css`、`portal.js` 因测试引用而保留；`scripts/verify-personal-site.mjs` 仍断言旧标题"资源收藏与搜索"（不在 pages.yml 内），可同步断言或下线。
4. 占位文案：副标题"切开颜色，留下作品"、关于区、版权行、作品名与简介、拟声词、各作品链接（`#`）均为占位。
5. 英文装饰标签（SKIP / SCROLL / Ctrl K / ALL 14 等）是否保留。均有中文主标签或 `aria-hidden`。
6. 颜色取采样值 `#0537B4` / `#90072A`，而非标准 `#002FA7`。
7. 标题回退用描边而非 `mix-blend-mode`（偏离原需求文字）。
8. 子页面（game / minsheng / messages / privacy / admin）仍是旧月光主题，从首页进入会有风格突变，是否统一待定。
9. 开场 full 约 2.5s，嫌长可只改 `site/js/loader/loader.js` 的时间线。
10. 窄屏（360–430px）窗口卡标题栏文件名与控件点、NEW 角标重叠，ARCHIVE 拟声词前半被裁（LOW，不阻断，可后续迭代）。
11. `.agents/` 目录是否随分支入库。

## 6. 后续如何新增类别 / 载体

当前分类（第二轮精简）：筛选栏共 5 项 = `all`（由代码提供，名称

新增类别：在 `categories` 追加 `{ id, name, en, carrier, accent, parallax, order }`。`carrier` 取 `phone / window / page / shard`，未知名称回退 `shard`。筛选栏、计数、命令面板由清单驱动。注意清单里现有的 `cartridge`、`tab`、`disc` 目前都回退为 `shard`，并非独立载体。

新增载体外形：在 `site/js/carriers/` 新建模块（参照 `phone.js` / `shard.js`），在 `site/js/carriers/index.js` 里 `registerCarrier(type, carrier)` 或加入 `registry`，再让类别的 `carrier` 指向它；单个作品也可用 `work.carrier` 覆盖类别默认值。改完跑 `node scripts/test-site.mjs` 与 `node scripts/verify-home-redesign.mjs --section=wall`。

## 7. 第二轮 A：切换分类时作品墙高度连续补间

根因：`filter.js` 里 `Flip.from(state, { absolute: true })` 会把全部 `.slot` 临时改成 `position:absolute`，网格容器 `.wall` 失去所有流内子元素，高度塌成 0；动画结束 Flip 还原，墙高又瞬间弹到新值。字幕条与「关于」跟着墙底忽上忽下（基线实测：1440×900 全部→软件 墙高 2953→0；手机 1061→0）。

修法：新文件 `site/js/wall/morph.js`（导出 `MORPH_MS=700`、`MORPH_EASE`、`PEAK_SLOPE=4`、`createMorph`）。切换前读旧墙高、抓 Flip 状态、结束上一轮，切换 hidden 后测新墙高，钉住旧高度，再同时启动 Flip 与一条墙高 tween。快速连点由后一次接管前一次（seq 保证只有最后一轮收尾）。收尾一次性：清内联高度与 `is-morphing`、清 opacity（scale 重置为 1）、`ScrollTrigger.refresh()` 一次，并用 WAAPI 独立 `translate` 把常驻卡的视差位移补成 420ms 缓动。补间期间 `.wall.is-morphing` 用 `clip-path` 把压出墙底的进出场卡裁掉（已截图确认裁后不盖字幕条）。`filter.js`：calm / 无 GSAP / 路由即时路径一步到位，不再有 150ms 透明度闪烁，仅 `app.parallax.refresh()` 一次；删除 `busy` 分支。`wall.css`：`.wall { overflow-anchor: none }`。

验证（`verify-home-redesign.mjs --section=filter`，7 项）：桌面 1440×900 与手机 390×844 各 11 次互切（14↔6↔2↔4↔2 与 2↔14）+ 快速连点 5 次，reduced-motion 与 GSAP 404 一帧切换，popstate 即时路径。真实数值见 FEAT-002 findings。

与 plan-v2 的偏差：1）`PEAK_SLOPE` 由 3 改为 4（GSAP 的 `power3` 是四次方，中点斜率为 4，3 会误报）；2）`end()` 不能 `clearProps: 'scale'`（会连视差 y 一起清掉导致常驻卡瞬跳），改为 `clearProps: 'opacity'` + `scale: 1`；3）验收的时间基准用 GSAP ticker 时间，结算窗口的斜率上界用视差结算缓动的起点斜率 6.25 换算，而不是计划里固定的 0.25×Δ；4）加了 `.is-morphing` 的 clip-path（计划里的条件项，因进出场卡确实压出墙底）。

未验证：真机 60fps 与真实 GPU 下的主观丝滑感；Safari / Firefox；补间中窗口 resize 的极端情形；`translate` 属性不支持的老浏览器（结算动画自动失效，回到瞬跳）。验收环境为 swiftshader 软渲染。

第二轮 C：首屏已去掉鼠标涟漪与指针驱动（uMouse/uVel/uAspect 与 pointermove 移除，刀光角度固定 0.62），保留时间驱动的布料流动、窗格光影与昼夜；降级路径的 CSS 径向光不变。
