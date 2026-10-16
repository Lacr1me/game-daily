# 个人主页与资源库维护

首页采用 2026-10-16 确认的资源库布局。生产源码仍使用原生 HTML、CSS、JavaScript，不需要前端框架或包管理器。

## 入口与文件

- 网站首页：资源库、我的收藏、每日简报、关于这里。
- index.html：首页结构、图标与静态内容。
- home.css：首页专用样式；portal.css 提供留言、隐私和后台的基础布局与表单隐藏规则。
- brand.css：日报、留言、隐私和后台共用的银灰色主题、响应式布局、对话框及减少动态效果规则；两个日报渲染器也会内嵌此文件。
- site-shell.js：共用导航、原始 Logo、SVG 图标和归档切换过渡；不读取个人数据，不提供公开后台入口。
- portal.js：导航、搜索、收藏、详情、资源加载和双频道归档入口。
- portal-data.js：资源格式、链接、发布时间及最新日报选择规则。
- data/resources.json：作品清单；与两频道日报索引分开维护。
- brand-assets/springhues-logo.png：既有指定个人 Logo，保持原比例与透明度。

资源库当前为空，页面显示“作品正在整理”和日报入口。预览中的三个虚构项目只保留为 scripts/portal-resources.fixture.json 测试夹具，不会进入发布目录。

## 添加作品

在 data/resources.json 的 resources 数组中添加一个对象。schemaVersion 保持 1。以下只是字段示例，应替换为真实作品和文件地址后再收录：

```json
{
  "schemaVersion": 1,
  "resources": [
    {
      "id": "my-tool",
      "title": "作品名称",
      "category": "tools",
      "status": "published",
      "description": "说明这个作品能帮助访客完成什么",
      "version": "1.0.0",
      "platforms": [
        "已验证的平台"
      ],
      "tags": [
        "分类标签"
      ],
      "features": [
        "实际功能"
      ],
      "requirements": [
        "实际运行条件"
      ],
      "statement": "作者、来源、许可与使用说明",
      "downloadUrl": null,
      "sourceUrl": null,
      "fileSize": "",
      "filename": "",
      "updatedAt": "2026-10-17"
    }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| id | 唯一稳定 ID，小写英文、数字及单个连字符；以后改名时保留 ID，避免详情链接和收藏失效 |
| title、description | 必填名称与介绍，按纯文本显示 |
| category | tools 软件工具、design 网页设计、game 游戏资源 |
| status | published 已发布、developing 制作中、example 示例项目、draft 暂不在列表显示 |
| platforms、tags、features、requirements | 文本数组，可以留空，不填未经验证的兼容范围 |
| version、fileSize、updatedAt | 可选版本、文件大小与 YYYY-MM-DD 更新日期 |
| statement | 使用说明，支持换行 |
| downloadUrl | HTTPS 下载地址或 /downloads/ 下的站内文件路径；留空时显示不可用状态 |
| filename、downloadLabel | 可选站内下载文件名与按钮文字；外部文件由对方网站决定下载行为 |
| sourceUrl、sourceLabel | 可选 HTTPS 项目主页/来源链接及按钮文字 |
| publishAt | 可选、包含时区的 ISO 时间；到时才进入列表 |

示例项目不能配置真实下载。draft 和 publishAt 仅控制首页显示；静态 JSON 与发布目录内的文件仍可直接访问，不用于保存私有内容。未来资源按读取清单时的时间判断，刷新页面后显示。

原始链接限定 HTTPS 或明确站内路径；拒绝脚本协议、带账号信息的外链及本站后台入口。介绍、标题、标签和说明按文本处理。

## 日报与现有页面

每日简报区独立读取 data/index.json 和 data/minsheng/index.json，只显示已到北京时间 11:00 发布时间的最新归档。保留 civicLink、gameLink 等现有健康采集入口，并携带真实 date 参数。两频道独立失败、独立重试；历史选择和 PNG 下载继续由原频道页面处理。

首页仅提供留言页链接，不内嵌提交表单，也不提供管理员导航。昵称、回复、审核与鉴权流程保持原有实现。

所有在线历史期次复用当前频道页面，随共用主题更新。既有下载 PNG 保留原始归档，不因页面换肤重写；后续新期次使用统一渲染器生成当前样式。

收藏键为 springhues.resources.favorites.v1，仅在当前浏览器保存资源 ID。存储被拒绝时显示失败，界面不会提前变成已收藏。搜索、分类、收藏页及详情状态保存在 URL；返回列表会恢复筛选、位置与焦点。隐私说明已增加收藏与地址参数的范围。

## 本地运行与验证

在项目目录运行：

```powershell
node scripts/serve.mjs
```

默认地址 http://127.0.0.1:4173/ 。可通过进程级 PORT 环境变量指定其他端口。

按运行手册的代码基础链验证，另外使用：

```powershell
node scripts/test-portal-data.mjs
node scripts/test-messages.mjs
node scripts/verify-personal-site.mjs --base=http://127.0.0.1:4173/ --out=output/playwright/personal-site
node scripts/verify-site-theme.mjs --base=http://127.0.0.1:4173/ --out=output/playwright/site-theme
```

test-site.mjs 已包含资源数据测试。浏览器验证先检查真实清单和日报，再在浏览器内拦截清单请求注入测试资源；不会向正式清单写入示例或下载文件。测试覆盖桌面/手机、筛选、收藏、历史、复制失败、网络失败、中文输入、链接安全、未来期次和正常/减少动态效果。浏览器窄视口检查不等同于实体手机验收。

构建脚本带有清理逻辑，依照运行手册在新建且不含 dist、data/.pending 的隔离根执行 build-site.mjs 与 verify-build.mjs。本次构建只扩充首页文件白名单，没有修改日报正文、索引或发布状态。

本地实现和构建验证不代表部署完成。推送 main 会触发 Pages；上线前按项目授权与发布流程处理。
