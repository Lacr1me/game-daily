# 个人主页与作品墙维护

首页是 SHARD 风格的单页作品站：首屏主视觉、可筛选的作品墙、关于区。生产源码仍是原生 HTML、CSS、JavaScript（ES 模块），不需要前端框架或包管理器；动效全部用浏览器原生 WAAPI，只自托管一个滚动库 Lenis。子页面（游戏日报、民生日报、留言簿、隐私说明）使用同一套风格，规范见 [docs/shard-style.md](shard-style.md)。

> 本文取代早先“资源库 + 收藏 + 月影档案师配色”的描述以及设计阶段留在 `.agents/` 下的旧方案文档。那些文档保持原样仅作历史，其中关于旧动画库、7 个分类、收藏功能的内容不再适用。

## 入口与文件

- `index.html`：首页结构、内联图标、主题 / 开场 / 站内到达的首帧脚本。
- `site/css/`：`tokens.css`（调色板与日夜变量）、`base.css`、`loader.css`、`chrome.css`、`hero.css`、`wall.css`、`carriers.css`、`detail.css`、`about.css`、`effects.css`、`hero-lqip.css`、`wipe.css`（擦屏层与到达遮罩，首页与子页面共用）。子页面共享：`shard-theme.css`、`pages-daily.css`、`pages-messages.css`、`pages-privacy.css`。
- `site/js/`：`main.js` 启动器；`core/`（tier、scroll、wipe、page-transition、tween、flip、focus、url 等）、`hero/`、`wall/`、`carriers/`、`ui/`、`loader/`、`data/`、`shell/`（子页面外壳）。模块之间的 `import` 不带查询串，只有入口带 `?v=` 版本戳。
- `site/boot.js`：子页面启动脚本（主题防闪、`shard-live`、日报导出守卫）。
- `site/works.json`：作品与分类清单（驱动作品墙、筛选栏、计数和命令面板）。
- `assets/`：`fonts/anton-latin.woff2`、`hero/web/`（主视觉衍生图，由 `node scripts/build-hero-assets.mjs` 生成；5MB 原图不进入发布目录）。
- `vendor/lenis/`：平滑滚动库（见 `THIRD-PARTY-NOTICES.txt`）。
- `portal-data.js`：日报索引读取与 `publishedEditions`（只统计已到北京时间 11:00 发布时间的期次）。
- `brand-assets/springhues-logo.png`：指定个人 Logo，保持原比例与透明度。
- 旧门户遗留（不再是首页的一部分）：`home.css`、`portal.js`、`data/resources.json`、`scripts/portal-resources.fixture.json`；`portal.css` 仍是后台的基础布局与表单隐藏规则，`brand.css`、`site-shell.js` 同时被日报导出器与后台消费，三者都不要改。

## 当前配色

克莱因蓝 `#0537B4` 为主（约 60%），冷白 `#F4F6FF` 为辅（约 30%），勃艮第红 `#90072A` 只当“刃”（≤10%：新内容角标、关键按钮、强调线、悬停描边）。日间页面底是冷白，夜间是深蓝 `#0D1850`。色值与变量表见 `docs/shard-style.md` 第 3 节，源头是 `site/css/tokens.css`。主题保存在浏览器 `localStorage` 键 `springhues.home.theme`，默认跟随系统，首页与子页面共用。

## 作品与分类

首页分类共 4 个（软件工具、网页设计、游戏资源、每日简报），加上代码提供的“全部”共 5 个筛选项；载体外形 4 种（`phone / window / page / shard`）。新增作品、分类和载体的步骤见 `docs/shard-style.md` 第 10 节。作品链接只允许站内相对路径或 HTTPS，不得指向后台。清单里现有的“示例·某某”条目是占位内容，替换为真实作品后再对外宣传。

路由：`#work=<slug>` 打开作品详情，`#cat=<id>` 切换分类，`#works / #about / #top` 滚动到对应区块（子页面菜单使用 `./#works`、`./#cat=daily`、`./#about`）。旧链接 `?view=journal / about / saved / library` 与 `?work=<slug>` 仍会被映射到新位置。

## 日报与现有页面

每日简报入口独立读取 `data/index.json` 和 `data/minsheng/index.json`，只显示已到发布时间的最新归档，并带真实 `date` 参数；保留 `civicLink`、`gameLink` 等健康采集入口。两频道独立失败、独立重试；历史选择和 PNG 下载由频道页面处理。

首页只提供留言页链接，不内嵌提交表单，也不提供管理员入口；留言、回复、审核与鉴权流程不变。日报页的线上外壳与导出同源约束见 `docs/shard-style.md` 第 11 节：既有 PNG 不因页面换肤重写，新期次由统一渲染器生成。

## 本地运行与验证

```powershell
node scripts/serve.mjs
```

默认地址 `http://127.0.0.1:4173/`，可用进程级 `PORT` 环境变量换端口。常用验证：

```powershell
node scripts/check-shard-style.mjs                     # 样式检查
node scripts/test-site.mjs                             # 站点单测（含 test-home：首页与子页面静态检查、纯函数测试）
node scripts/test-messages.mjs                         # 留言系统与隐私说明
node scripts/verify-home-redesign.mjs --section=all    # 首页与子页面浏览器验收（本机 Edge，不进 CI；--section=pages 只跑子页面）
node scripts/check-export-parity.mjs --channel=both    # 日报导出一致性（改动日报页后）
```

构建脚本带有清理逻辑，按运行手册在不含 `dist`、`data/.pending` 的隔离根执行 `build-site.mjs` 与 `verify-build.mjs`，跑完删除 `dist`。`site/`、`vendor/` 整目录复制进构建产物，新增文件不需要改白名单；`verify-build.mjs` 对关键文件逐个断言。

本地实现和构建验证不代表部署完成。推送 main 会触发 Pages；上线前按项目授权与发布流程处理。
