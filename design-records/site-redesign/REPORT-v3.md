# REPORT-v3：第三轮前端重做（去 GSAP / 子页面统一 SHARD / 样式规范）

本报告只汇总既有证据（plan-v3、review-a、review-bc、verification-v3）与实际 git 状态，未重跑测试。不 commit、不 push、不新建分支。

## 1. 各阶段改动与文件清单

### 阶段 A：移除 GSAP
- 新增：`site/js/core/tween.js`（缓动表 + 关键帧采样）、`site/js/core/flip.js`（rectOf / flipDelta / playRectMorph / canAnimateRects）。
- 重写：`site/js/wall/morph.js`、`site/js/wall/parallax.js`。
- 修改：`core/scroll.js`（新增 `onScroll`）、`core/vendor.js`（删 `loadGsap`）、`core/app.js`、`main.js`、`wall/{wall,filter,detail}.js`、`css/wall.css`、`index.html`（版本戳）、`THIRD-PARTY-NOTICES.txt`（删 GSAP 条目）。
- 脚本：`scripts/verify-build.mjs`、`test-home.mjs`、`verify-home-redesign.mjs`。
- 删除：`vendor/gsap/`（3 个文件）。

### 阶段 B：子页面统一
- 新增：`site/boot.js`、`site/js/shell/{shell,links}.js`、`site/js/core/page-transition.js`、`site/css/{shard-theme,wipe,pages-daily,pages-messages,pages-privacy}.css`。
- 修改：`game/index.html`、`minsheng/index.html`（仅 `<head>` 内同一行追加外壳标签，各 1 行 diff）、`messages/index.html`、`privacy/index.html`（外围重做，正文不改）、`index.html`、`site/js/core/{wipe,focus,url}.js`、`ui/palette.js`、`css/loader.css`。
- 删除：`messages/messages.css`、`privacy/privacy.css`（迁入 `site/css/pages-*.css`）。

### 阶段 C：规范、主题 CSS、自检脚本、文档
- 新增：`docs/shard-style.md`、`docs/shard-style-prompt.txt`、`site/css/shard-theme.css`、`scripts/check-shard-style.mjs`、`scripts/check-export-parity.mjs`。
- 修改：`docs/personal-site.md`（重写）、`AGENTS.md`（仅目录入口一行 + 视觉路由一行）、`scripts/{test-site,test-messages,test-portal-data}.mjs`。

当前 `git status`：18 个已跟踪文件有改动（559 增 / 365 删），其余为未跟踪新增（`site/`、`vendor/`、`assets/`、`.agents/`、新脚本与文档）。`.gitignore`、`portal-data.js`、`scripts/{build-site,serve}.mjs` 的改动来自前两轮，不属于本轮。

## 2. GSAP 移除：体积与原生替换

| 项 | 前 | 后 |
| --- | --- | --- |
| `vendor/` 合计 | 160,420 B（gsap 72,435 + ScrollTrigger 44,157 + Flip 25,013 + lenis 18,815） | 18,815 B（仅 lenis），−141,605 B（−88%） |
| 自写代码 | 无 | tween/flip/parallax/morph 四文件合计 14,742 B（未压缩）；`site/js` 总计 121,290 B |

`vendor/` 现在只有 `vendor/lenis/lenis.min.js`，已在工作区核实。

原生替换方案：
- 筛选补间、卡片位移/缩放、墙高：WAAPI，同一条 `document.timeline`。
- 缓动：`core/tween.js`。`power3InOut` 保持四次方，峰值斜率 4，所以 `PEAK_SLOPE=4`、`MORPH_MS=700`、`SETTLE_PEAK=6.25`、1.15 容差都没放宽。
- FLIP：自写 `core/flip.js`。位移用 `translate`（`composite:'add'`），缩放用 `scale`，不覆盖 `.face` 既有变换。降级链为原生 FLIP、View Transitions、直接切换。
- 滚动视差：Lenis + 原生 scroll + IntersectionObserver，写 `--py`，公式与旧 `46p → -46p` 等价并有单测。

关于「GSAP 许可确认」：这指第一阶段引入的第三方库 GSAP，它使用 Standard「no charge」许可，不是 MIT，与用户自己的项目无关。个人作品站使用其实不违规，但用户决定直接去掉。Lenis（MIT）、Anton（OFL）保留。

全仓大小写敏感扫描 `gsap|GSAP|ScrollTrigger|\bFlip\b`（排除 `.agents/`）零命中。该扫描已写成 `test-home` 断言，`verify-build` 也对 dist 做同样检查。

旧设计文档（`.agents/` 下早期方案、`REPORT.md` 第 7 节等提及 GSAP 的内容）保持原样，已被本报告、`docs/shard-style.md` 和更新后的 `docs/personal-site.md` 取代。

## 3. 子页面改版范围与截图

范围：游戏日报 `game/`、民生日报 `minsheng/`、留言页 `messages/`、隐私页 `privacy/`。统一的内容有 SHARD 页首、全屏菜单、页脚、日/夜主题同步、碎片擦屏过渡、切角卡片、零圆角。留言与隐私页正文和全部钩子保留（`message-client.js`、`message-config.js`、`messages/app.js` 与 HEAD 相同）。日报页夜间正文保持冷白纸面。

截图目录：`f:\Codex-App\日报设计\.worktrees\site-redesign\.agents\tasks\site-redesign\screenshots\pages\`（当前 24 个文件）。
- `{game,minsheng,messages,privacy}-{day,night}-{1440x900,390x844}.png`，共 16 张。
- 另有菜单、擦屏进行中、归档弹窗、留言已配置/未配置、民生对齐等专项图。

## 4. 导出消费文件无变更与隔离审计

本步实际执行的 git 检查：
- `git diff --name-only HEAD -- styles.css brand.css site-shell.js app.js minsheng/app.js minsheng/styles.css minsheng/aligned-layout.css minsheng/mobile-fix.css message-config.js message-client.js messages/app.js` 输出为空。
- `git diff --numstat` 对 `game/index.html`、`minsheng/index.html` 各为 `1 1`，即 `<head>` 内同一行追加外壳标签。
- `git diff --name-only HEAD -- data downloads artifacts config supabase .github admin` 输出为空，`git status` 对这些目录也无条目。

隔离机制：导出器冻结了 `Date`，`site/boot.js` 据此不加 `html.shard-live`，`shell.js` 立即退出，`shard-theme.css` 和 `pages-daily.css` 的规则（脚本强制全部以 `html.shard-live` 开头）不生效。已有证据：`check-export-parity --channel=both` 用真实技能 `render.mjs` 对基线树与当前树渲染，HTML 快照与 PNG 字节相同（`parity-iter2.log`）。早先一次 PNG 差异经「基线对基线」对照，确认是游戏导出器自身的不确定性，不是外壳造成。

字面命令 `git diff main -- data downloads …` 不为空，原因是 main 在分支切出之后发布了 2026-10-17 期，不是本任务改动；相对 merge-base 和 HEAD 均为空。

## 5. 规范与工具用法

- `docs/shard-style.md`：完整规范，含调色板、语义变量日/夜表、`.sd-*` 组件、门控规则、跨文档 View Transition 整站不用。
- `docs/shard-style-prompt.txt`：一键提示词，与规范文档开头的提示词代码块逐字相同。以后让 AI 做新页面，把它贴给 AI 即可。
- `site/css/shard-theme.css`：跨页面核心，包含 tokens、切角工具、外壳与组件，规则全部门控在 `html.shard-live`。新页面引用它，再加自己的 `pages-<名>.css`。
- `scripts/check-shard-style.mjs`：`node scripts/check-shard-style.mjs` 检查非零圆角、未引用 theme、未定义 token、token 与 `tokens.css` 一致性、版本戳、命名色，另有 `--self-test`。有错误时退出码为 1。
- `scripts/check-export-parity.mjs`：`--channel=game|minsheng|both`，只写系统临时目录，不碰日报生产。
- 当前资源版本戳：`SHARD_VERSION = 20261018-shard-v4`。

## 6. 验证状态

已验证（来自 verification-v3 与两份评审）：
- 阶段 A：`verify-home-redesign --section=all` 48/48。位移比 0.94（上限 1.15），桌面每次切换 resume 恰好 1 次，lite 为 0 次。
- 阶段 B/C 第二次迭代：`--section=all` 61/61，`pages` 分区 13/13。`test-site` 含 `test-home` 25 组，另有 messages、portal-data、build、`verify-build`、`check-shard-style`（0 错误）和 `check-export-parity`，均通过。
- 评审者在 Edge 里亲自走了日报页到留言页、隐私页、首页、另一频道的跳转，零未捕获错误。四页在 1440 和 390 宽无横向滚动，文字对比度 ≥4.5:1，红色面积 ≤2.14%。

未验证：
- 真机丝滑感和 60fps。验证环境是无头 Edge + swiftshader 软渲染，约 40ms/帧。
- 真实 GPU。
- Safari、Firefox 等其它浏览器。
- 动效只在静态帧和逐帧采样层面验证，视差手感未与旧实现逐帧对比。
- 「无 WAAPI」降级用例没做；A0 旧版基线没跑，对比用的是规划里记录的基线（位移比 0.95）和未改的绝对阈值。
- 读屏软件与完整 WCAG 人工评审、bfcache 真实恢复、真实 Turnstile 提交。

## 7. 待决策与保守处理

1. 游戏页日间首屏蓝色占比约 29.8%，低于 30% 的目标。原因是日报纸面保持冷白，已在规范中明示为例外。若想要更蓝，需缩小白面板，会改变日报纸面呈现。
2. 未更新 `site-shell.js`、`brand.css` 的 `?v=` 戳。它们被导出器和后台共用，保持字节不变是为了让日报导出不变，与任务书原要求有出入。
3. 整站不使用跨文档 View Transition。评审建议的 opt-in 方案实测会让子页面到首页的导航报错，最终改为在 `pages-daily.css` 里 `navigation:none`。切页动画仍由碎片擦屏负责，用户看到的效果不变。
4. `playRectMorph` 在连点被打断时，`.slot` 上可能留下内联 `transform-origin: 50% 50%`（等于默认值，无视觉影响，评审标为 LOW，未修）。
5. `hero: 帧探测` 在 CPU 节流下偶发 40s 超时，单独复跑通过，阈值未改。
6. 本轮没有以 warning 暂停的取舍。所有改动均未 commit，合入前仍需用户决定。
