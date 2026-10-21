// Process copy carried over from the approved project anatomy.
// Build-only source; the generator includes the six steps and system notes.
export const CONTENT = {
  versions: { windows: '0.2.11', android: '2.3.51' },
  steps: [
    {
      short: '接入',
      title: '让一个链接进入系统',
      lead: '分享文字与网页汇入同一入口',
      mechanism: '接收台把分享文字和网页资源送入两条入口滑轨',
      windows: {
        text: '粘贴分享文字，或在内置浏览器里主动嗅探资源。平台链接与网页候选从这里进入各自的识别路径。',
        detail: '网页任务保留当前页面所需的公开请求头。遇到特定请求失败，可接回当前浏览器响应流，让资源沿原会话继续传输。',
        tag: 'WebView2 · BrowserRequestContext',
      },
      android: {
        text: '从其他应用分享文字，或粘贴链接开始解析。内置网页嗅探提供另一条入口，普通文件和 HLS 都能形成下载候选。',
        detail: '系统纯文本分享进入解析页；网页保存交给统一的任务运行体系。后续操作围绕持久任务展开，入口与传输执行各司其职。',
        tag: 'ACTION_SEND · BrowserTransferExecutor',
      },
    },
    {
      short: '识别',
      title: '把网页地址读成作品',
      lead: '识别平台 整理可下载资源',
      mechanism: '识别透镜读取链接，将标题与媒体轨道装进同一份作品卡',
      windows: {
        text: '解析器按平台接手链接，把标题、媒体资源和可用格式整理成作品。当前接入抖音、哔哩哔哩与小红书。',
        detail: '解析结果交给独立的解析记录与工作区。下载阶段使用结构化作品和用户的输出选项，必要时重新解析来源以刷新地址。',
        tag: 'ResolverRegistry · ParseJournal',
      },
      android: {
        text: '抖音、哔哩哔哩、小红书和今日头条各有适配器。独立解析队列整理作品资源，再把成功结果关联到下载任务。',
        detail: '开启后台解析后由 WorkManager 调度。平台解析在适用时使用 WebView 回退，解析过程与实际文件传输分别管理。',
        tag: 'BatchResolveCoordinator · ResolverRegistry',
      },
    },
    {
      short: '调度',
      title: '给每份作品一个位置',
      lead: '排队 暂停 恢复都有记录',
      mechanism: '任务卡进入可暂停的输送轨道，调度闸门按可用位置依次放行',
      windows: {
        text: '下载协调器将作品和保存选项登记为任务，统一处理排队、进度、暂停、继续与取消，让界面跟随真实状态变化。',
        detail: '任务记录写入本地 JSON。重启时对账未完成任务；平台任务可重新解析来源，依赖网页会话的任务可能需要再次提供来源。',
        tag: 'DownloadCoordinator · JSON',
      },
      android: {
        text: '任务写入 Room 后再唤醒系统队列。暂停先保存状态，恢复时重新调度，断网和仅 Wi-Fi 规则也由同一流程处理。',
        detail: 'Android 14 及以上在可用时采用用户主动传输任务；其余情况使用 WorkManager 前台执行，并在启动时对账恢复。',
        tag: 'Room · UIDT / WorkManager',
      },
    },
    {
      short: '传输',
      title: '让字节沿正确路径抵达',
      lead: '普通文件与流媒体分别传输',
      mechanism: '并行管线输送文件片段，另一组轨道按清单收集流媒体分片',
      windows: {
        text: '普通文件按服务器能力进行 Range 续传与分段下载；HLS 按清单并发收集片段，并记录已经完成的部分。',
        detail: '单文件连接配置为 4–64，默认 4，实际数量受文件大小与服务器支持限制。HLS 检查点帮助复用已完成的片段。',
        tag: 'HTTP Range · HLS Checkpoint',
      },
      android: {
        text: '普通文件通过 Range 与 If-Range 检查续传身份；全局 1–10 个网络传输位置约束并发，HLS 先把清单分片存入缓存。',
        detail: '续传比较 ETag 或修改时间，避免拼接不同版本的文件。普通流量直接按策略传输，明确的仅 Wi-Fi 与断网等待继续生效。',
        tag: 'Range / If-Range · Media3 Cache',
      },
    },
    {
      short: '处理',
      title: '把素材装配成可用文件',
      lead: '下载之后 还有必要的装配',
      mechanism: '媒体工作舱将独立音轨、画面与图片配件装配成最终成品',
      windows: {
        text: 'FFmpeg 合并分离的音视频轨道，把 HLS 封装为 MP4。输出选项还可以决定音频提取、字幕和实况配对。',
        detail: '合并与常规封装使用流复制；选择 MP3、FLAC 或 WAV 等音频格式时会编码。处理完成后，成品才进入正式保存阶段。',
        tag: 'FFmpeg · Merge / Remux',
      },
      android: {
        text: '下载缓存进入本地媒体处理，再生成合并视频、提取音频或图片实况。HLS 导出直接读取已经收集的分片缓存。',
        detail: 'HLS 的 exportCached 在处理阶段从本地缓存完成封装，避免再次向上游拉取。下载、处理和保存分别反馈当前进度。',
        tag: 'Local Media · exportCached',
      },
    },
    {
      short: '归档',
      title: '让完成的作品有处可寻',
      lead: '正式保存后 进入作品库',
      mechanism: '分类档案架接住完整成品，作品卡与真实文件在这里重新对应',
      windows: {
        text: '成品按类型和本地日期写入选定目录，同一作品共用发布日期。作品库读取这些分类目录，也兼容根目录里的旧文件。',
        detail: '多文件作品准备完成后才正式保存，发布失败会回收已写入的子项。文件路径、媒体配对与作品记录共同构成后续管理依据。',
        tag: '类型 / yyyy-MM-dd · FilePublisher',
      },
      android: {
        text: '图片与视频发布到 DCIM/EasyDow，相册中可直接查看；其他文件进入系统 Download 目录，成功后登记成品并清理缓存。',
        detail: 'MediaStore 先以待完成状态写入，复制完成后再批量设为可见。出现失败时回收本次创建的条目，保留清晰的保存边界。',
        tag: 'MediaStore · IS_PENDING',
      },
    },
  ],
};

export const SYSTEMS = [
  {
    id: 'architecture',
    title: '架构分工',
    kicker: '同一条主线 各层各司其职',
    windows: 'App 装配 WPF 窗口与系统服务，Presentation 维护界面状态，Core 承载解析、下载、媒体和作品库。MCP 以独立桥接进程接入。',
    android: '应用层承接 Compose 界面、系统分享与网页浏览；核心模块分别负责平台解析、Room 数据、任务下载和媒体发布。系统调度承接后台执行。',
  },
  {
    id: 'continuity',
    title: '任务连续性',
    kicker: '状态与文件一起向前',
    windows: '任务 JSON、下载临时文件与 HLS 检查点分别保存执行状态。暂停与恢复围绕同一任务进行，地址失效时按来源重新解析。',
    android: 'Room 保存任务，系统工作队列负责执行。暂停先落盘，恢复再调度；网络规则与启动对账让任务在允许的条件下继续。',
  },
  {
    id: 'ai',
    title: 'AI 接入',
    kicker: '让现有能力成为可调用工具',
    windows: '外部 AI 客户端通过随包 MCP 的 stdio 通道连接，再经当前用户命名管道访问应用。每次调用核对凭据与权限，复用已有下载服务。',
    android: '手机端通过系统分享接收链接，由应用内任务操作和系统通知承接后续交互。本图中的 MCP 自动控制通路对应 Windows 随包组件。',
  },
  {
    id: 'maintenance',
    title: '更新维护',
    kicker: '版本之外 还有分发身份',
    windows: '官网清单同时比较版本与分发身份，相同版本的新修订也能被识别。安装包下载校验后交给安装器，卸载默认保留个人数据和图库。',
    android: '优先读取官网更新清单，网络或 HTTP 故障时再尝试 GitHub API。下载后校验包身份和安装签名，再进入系统安装流程。',
  },
];

export const RECENT = [
  {
    platform: 'windows',
    version: '0.2.11',
    date: '2026-10-21',
    title: '安装目录与卸载更清楚',
    text: '选择父目录时补全“简单下载”，升级保留登记目录。卸载分别提供本地数据与图库清理选项，默认均不勾选，可确认归属的图库成品进入回收站。',
  },
  {
    platform: 'android',
    version: '2.3.51',
    date: '2026-10-21',
    title: '更新可靠 日常操作更简洁',
    text: '更新检查优先使用官网清单；批次结果与媒体信息入口仅调试显示。移除普通流量确认，继续遵守仅 Wi-Fi、断网等待与手动暂停。',
  },
];
