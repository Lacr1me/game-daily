# 游戏方块日报

一个每天北京时间 11:00 更新的中国游戏与 Minecraft 日报网站。首页自动展示最新已发布一期，也可以从日期归档查看历史日报。

## 公网部署

网站通过 GitHub Pages 发布。`main` 分支每次更新都会触发 `.github/workflows/pages.yml`，由 `scripts/build-site.mjs` 生成只包含网页运行文件的 `dist` 发布目录。

## 本地预览

可以直接双击 `index.html` 离线打开。开发调试时也可以启动本地 HTTP 服务：

```powershell
node scripts/serve.mjs
```

然后访问 `http://localhost:4173`。

## 每日自动更新

项目内置一个完整的日报 GitHub Actions 工作流：

- 北京时间 10:50：在 Actions 运行器内联网检索并生成草稿。
- 北京时间 11:00：校验栏目数量、发布到 `data/YYYY-MM-DD.json` 并更新归档索引。
- 草稿不会提交到公开仓库，因此不能在 11:00 前绕过首页读取。

需要在仓库的 **Settings → Secrets and variables → Actions** 中添加 `OPENAI_API_KEY`。未配置密钥时，定时任务会正常跳过且保留现有网站。生成脚本使用 Responses API、Web Search 与严格 JSON Schema。

> GitHub 的定时任务可能有数分钟排队延迟。如果必须精确到 11:00:00，建议将相同脚本部署到支持精确定时的云函数；前端仍会依据 `publishAt` 隐藏未到发布时间的期次。

## 数据约定

`data/index.json` 是归档索引。每期 JSON 固定包含 2 条头条、10 条游戏新闻、10 个 Minecraft 整合包、6 个 Mod、4 个 Steam 优惠和 4 条趋势观察。网站按 `publishAt` 判断期次是否可见。

`data/embedded.js` 是供 `file://` 直接打开使用的离线数据包，会在每日发布时自动重建。
