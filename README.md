# 每日简报双频道网站

一个每天北京时间 11:00 更新的静态日报网站，包含两个独立频道：

- `/minsheng/`：民生日报，每期固定 35 条中国时政与民生、全球国际、中国科技和 AI 科技新闻，并包含数据速览。
- `/game/`：游戏方块日报，保留中国游戏、Minecraft、Mod 与 Steam 优惠内容。
- `/`：双频道门户，显示两个频道最新已发布期次。

两个频道都支持 `?date=YYYY-MM-DD` 历史日期链接。前端按照 `publishAt` 隐藏未到发布时间的内容，并在每期页面最下方提供对应日期的 3840px PNG 原图下载按钮；公开文件位于 `downloads/minsheng/` 和 `downloads/game/`。

## 本地预览与验证

```powershell
node scripts/build-embedded.mjs
node scripts/build-site.mjs
node scripts/test-site.mjs
node scripts/serve.mjs
```

然后访问 `http://localhost:4173`。构建产物位于 `dist/`，只包含公开网页和已发布数据，不包含 `data/.pending/` 草稿。

单独校验民生日报：

```powershell
node scripts/validate-minsheng.mjs data/minsheng/2026-08-23.json
```

单独校验游戏日报或检查当天本地与线上发布健康状态：

```powershell
node scripts/validate-game.mjs data/2026-08-23.json
node scripts/check-daily-health.mjs --live=https://springhues.com
```

## 每日自动更新

日报由绑定到本地“日报设计”项目的 Codex 定时任务执行，不再通过仓库脚本调用 OpenAI API，也不需要 `OPENAI_API_KEY`：

1. 每天北京时间 10:30，Codex 以保存的完整任务说明启动一个全新的独立任务会话，完整读取双频道模板并严格执行其中要求的搜索与权威来源回退，不复用上一次运行的聊天上下文；目标在 10:50 前完成草稿。
2. 10:50—11:00 只进行发布前校验和必要修正；两个频道独立校验，一个频道失败不会阻塞另一个频道。
3. 通过校验的草稿先保存在未公开、被 Git 忽略的 `data/.pending/`。
4. 北京时间 11:00 后发布成功频道，更新归档索引，将当天 3840px PNG 写入对应 `downloads/` 目录并提交到 `main`。
5. `main` 分支更新后，`.github/workflows/pages.yml` 强制重建嵌入数据、运行完整测试并构建；任何失败都会阻止部署。
6. 11:10 以另一个全新独立任务会话运行健康检查，验证 JSON、HTML、PNG、下载按钮、GitHub Pages 和线上资源，只补救失败频道或失败部署；再次失败则保留上一期并通知人工处理。

每次发布还必须通过日期一致性门禁：归档日期、正文日期、期号、文件名和 11:00 发布时间必须完全对应；游戏资讯只能来自日报当天或前一天，新一期配图必须使用以当天日期开头的独立文件名；两个频道都会与最近 7 期比对标题和原文链接，超过栏目允许的重复上限即拒绝发布。11:10 健康检查与 GitHub Pages 部署复用同一套门禁。

仓库中不包含自动模型生成调用。若定时任务未运行或当天生成失败，网站继续展示最近一期有效内容，不发布空日报。计划时间是目标时间，实际完成时间可能受本地执行环境、检索和部署耗时影响。

需要人工发布已经准备好的草稿时，可在北京时间 11:00 后运行：

```powershell
node scripts/publish-minsheng.mjs
node scripts/publish-brief.mjs
node scripts/build-embedded.mjs
node scripts/test-site.mjs
```

## 民生日报数据约定

`data/minsheng/index.json` 是民生归档索引。每期 `YYYY-MM-DD.json` 固定包含：

- 中国时政与民生 10 条
- 全球国际 10 条
- 中国科技 10 条
- AI 科技 5 条
- 从正文 ID 引用的今日 3 件大事
- 国内金价、中国油价、国际油价和人民币兑美元／欧元／日元等数据
- 今日观察、来源、检索截止和制作时间

网页不请求定位或天气服务，也不显示天气区域。
