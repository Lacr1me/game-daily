# 每日简报双频道网站

一个每天北京时间 11:00 更新的静态日报网站，包含两个独立频道：

- `/minsheng/`：民生日报，每期固定 35 条中国时政与民生、全球国际、中国科技和 AI 科技新闻，并包含数据速览。
- `/game/`：游戏方块日报，保留中国游戏、Minecraft、Mod 与 Steam 优惠内容。
- `/`：双频道门户，显示两个频道最新已发布期次。

两个频道都支持 `?date=YYYY-MM-DD` 历史日期链接。前端按照 `publishAt` 隐藏未到发布时间的内容。

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

## 每日自动更新

`.github/workflows/daily-brief.yml` 在北京时间 10:50 启动：

1. 游戏日报和民生日报并行调用 OpenAI Responses API，通过 Web Search 检索并生成严格结构化草稿。
2. 两个频道独立校验；一个频道失败不会阻塞另一个频道。
3. 成功草稿保存在未公开、被 Git 忽略的 `data/.pending/`。
4. 工作流等待至北京时间 11:00，再发布成功频道并一次性提交数据。
5. `main` 分支更新触发 GitHub Pages 构建。

需要在仓库 **Settings → Secrets and variables → Actions** 添加 `OPENAI_API_KEY`。未配置密钥或当天生成失败时，网站继续展示最近一期有效内容，不发布空日报。

GitHub Actions 的计划任务可能排队，因此 11:00 是目标发布时间而非秒级保证。

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
