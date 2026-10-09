# 2026-10-09 日报未上线问题：宿主根因修复与项目恢复流程

本次已定位并修复导致入口命令失败的 Codex helper 文件共享冲突，普通沙箱命令与新 setup 日志通过；同时补充项目恢复流程。没有重启应用或终止其他聊天进程。本报告不证明任何期次已经制作、发布或线上健康；补刊结果须另以对应日期的结构化状态、产物、目标提交、Pages 和新鲜线上健康证据验收。

## 已确认的宿主故障

Windows 沙箱 setup 在核验运行时读/执行权限时，打开正在运行的 `node_repl.exe` 以更新 ACL 失败，Windows 返回 `os error 32`（另一个程序正在使用此文件）。上层仅显示 `helper_unknown_error` 和 `setup refresh had errors`，使入口命令无法正常执行。

原始证据来自本机 `C:\Users\Lacr1me\.codex\.sandbox\`：修复前的 `setup_error.json`，以及持续保留的 `sandbox.2026-10-07.log`、`sandbox.2026-10-08.log` 和 `sandbox.2026-10-09.log`。成功 setup 后错误文件已清除；此报告只记录必要字段和时间，不复制完整运行日志或秘密。

| 北京时间 | 直接观察 |
| --- | --- |
| 2026-10-07 17:51:53 | `sandbox.2026-10-07.log` 中 setup refresh 仍为 `errors=[]`，使用 `bin\5ea220ae823df3d7` 的 helper。 |
| 2026-10-07 19:05:23 | 同日志第 32536 行首次出现此运行时错误，helper 路径为 `bin\979a96ce184041d1`，失败目标为 `runtimes\cua_node\2c9e75c4e9c71beb\bin\node_repl.exe`。这是此次查阅的 10-06/10-07 日志中的首次命中，不代表所有历史的首次故障。 |
| 2026-10-08 08:00:09 起 | `sandbox.2026-10-08.log` 持续出现同一错误，失败目标改为 `runtimes\cua_node\3dd31cfff853001c\bin\node_repl.exe`。 |
| 2026-10-09 18:36:21 | `sandbox.2026-10-09.log` 中仍是同一 error 32；当前 helper 位于 `bin\9691020b546a15b2`。 |
| 2026-10-09 18:56:16 | 通过环境审批，备份后仅原子替换实际使用的 setup helper 为已含官方修复的签名二进制；app-server 和全部 9 个已有 Node REPL 进程保持运行。 |
| 2026-10-09 18:56:29 起 | 首条新鲜 setup refresh 返回 `errors=[]`；随后普通沙箱的 Git 和 Node 只读命令成功，没有协议错误，无须还原。 |

上述 `bin` 和 `runtimes` 路径相对于 `C:\Users\Lacr1me\AppData\Local\OpenAI\Codex\`。当前失败文件与 helper 都实际存在，文件 ACL 已有 `CodexSandboxUsers` 的继承读/执行权限。没有证据支持“C 盘清理移走 helper 或运行时文件”的解释。

本次进程快照显示 9 个该路径的 `node_repl.exe`，父进程均为 Codex app-server（PID 84380）；其中 PID 26440 创建于 18:31，属于当前工作期间，不能将这些进程一律当成无用残留。

## 只读复现与结论边界

对失败目标使用 Win32 `CreateFileW` 只打开句柄并立即关闭，不写文件、不改变 ACL：

| 请求访问权 | 共享模式 0、1、3、7 的结果 |
| --- | --- |
| `READ_CONTROL`、`WRITE_DAC`、二者组合 | 全部成功。 |
| `GENERIC_READ`、`FILE_WRITE_ATTRIBUTES` | 全部成功。 |
| `GENERIC_WRITE`、`GENERIC_READ \| GENERIC_WRITE` | 全部返回 error 32。 |

日志和探针说明故障发生在宿主对运行中可执行文件的访问兼容性环节；普通 ACL 元数据访问可用。随后核对的 [OpenAI 官方 PR 51822](https://github.com/openai/codex/pull/51822) 明确确认旧实现以 `MAXIMUM_ALLOWED` 打开活动 EXE/DLL，触发共享冲突；修复后仅目录使用这一权限，文件只在确需更新 ACL 时请求 `READ_CONTROL | WRITE_DAC`。其回归测试在保持 `node.exe` 以 `FILE_SHARE_READ` 打开的同时修复并复核运行时权限，与本机失败和探针一致。

## 官方 helper 修复与新鲜验收

当前 app-server 的核心版本为 `0.162.0-alpha.2`。选择 [官方 release `rust-v0.162.0-alpha.17.2`](https://github.com/openai/codex/releases/tag/rust-v0.162.0-alpha.17.2) 的独立 `codex-windows-sandbox-setup-x86_64-pc-windows-msvc.exe`，准确大小 17,724,880 字节，PE 架构 AMD64。下载文件与官方 release API 的 SHA-256 digest 一致，Authenticode 为 `Valid`，发行人为 `OpenAI OpCo, LLC`。没有安装整个预发布版本或替换 runner。

已逐文件比对当前版本与该 release 的官方源码：整个 Payload 解析/执行实现 `setup_provisioning.rs`、setup 入口、启动和环境传输文件的 Git blob SHA 完全相同；Payload 生成文件 `setup.rs` 仅将 `is_elevated` 的 Rust 可见性改为 `pub(crate)`，规范化后全文相同。双方 `SETUP_VERSION=5`。这支持本次只替换 helper 的协议兼容；实际普通沙箱命令进一步验收了当前组合，不能将混合版本组合称为官方整包升级。

| 项目 | 实际记录 |
| --- | --- |
| 替换目标 | `C:\Users\Lacr1me\AppData\Local\OpenAI\Codex\bin\9691020b546a15b2\codex-windows-sandbox-setup.exe` |
| 原 SHA-256 | `ab7b6f92a7fc6cf75230ff1ef212d1fdc3c242391b77e6491b0daba274174480` |
| 修复后 SHA-256 | `82b1fb2c227fb2ce7edd6e0c6493db3cb8574f1e51c74ac3d8f96ca945e39441` |
| 项目备份 | `output/host-sandbox-repair/2026-10-09/codex-windows-sandbox-setup-before-ab7b6f92.exe.bak`，哈希与原文件一致。 |
| 原目录原子备份 | `bin\9691020b546a15b2\springhues-sandbox-setup-before-ab7b6f92-20261009.bak`，哈希与原文件一致。 |
| 普通沙箱复核 | `git status --short`、`git status --short --untracked-files=no`、Node 只读输出均退出 0；Node 输出为 `sandbox-ready v24.19.0`。 |
| 新日志 | 首条成功为 18:56:29.424216，之后 18:56:34、18:56:38、18:57:01 等多次 setup 完成，均为 `errors=[]`。 |

替换前后 app-server 均为 PID 84380，创建时间不变；9 个原有 `node_repl.exe` 的 PID 和创建时间均保留，没有停止进程或重启。没有改全局配置、runner 或人工重置 ACL；正常 setup 仍按既有权限规则执行。[替换记录](../../output/host-sandbox-repair/2026-10-09/helper-replacement.json) 保存精确身份和备份，[验收记录](../../output/host-sandbox-repair/2026-10-09/helper-verification.json) 保存新鲜普通沙箱检查与日志。

## 三个计划的运行时覆盖与后续边界

只读核对三个实际 `automation.toml` 均为 `ACTIVE`、`execution_environment="local"`，工作目录为本项目；未更改其调度、模型和推理强度。当天实际运行的 session 元数据和 `Automation ID` 与 setup spawn 日志交叉核对如下：

| 计划 ID | 当天代表运行与线程 | 核心版本 / 实际 helper |
| --- | --- | --- |
| `05-00-10-00` | 06:02，`01a11d89-ee24-7f22-ad3c-fe7b2015de9a` | `0.162.0-alpha.2` / `bin\9691020b546a15b2` |
| `automation` | 10:33，`01a11e82-7549-7683-ba12-ec7b5b6fbd13` | `0.162.0-alpha.2` / 同上 |
| `11-10` | 11:31，`01a11eb7-196e-77a2-9b47-748e8c485bad` | `0.162.0-alpha.2` / 同上 |

三者使用的正是此次修复的共享安装目录，修复不是当前聊天单独生效的参数。但未人为触发计划，下一次实际无人值守运行及完整发布仍需按其真实结果验收。未来桌面应用或核心更新可能采用新目录、重新下载 helper，更新后应核对实际路径并复测普通沙箱；不能仅按版本号认为已含修复（本次查到正式 `0.162.0` 和 `0.162.0-alpha.18.1` 的源码仍未包含 PR 51822）。项目入口保留审批重试分支，避免宿主再次初始化失败时漏掉可恢复工作。

## 项目恢复修复

- [AGENTS.md](../../AGENTS.md) 在入口上下文直接指出宿主初始化失败的恢复分支，避免连手册和状态都读不到时立即结束。
- [运行手册](../daily-runbook.md#宿主命令初始化失败恢复) 要求先确认原命令未执行，再以同一已授权命令经 `require_escalated` 环境审批重试；结果不确定时先核对状态和事务。审批拒绝必须准确报告，不得改路径绕过。
- 手册明确 11:31 最后恢复轮没有新的同日边界，恢复执行后继续可修复工作并续租；宿主故障不能冒充日报完成。
- 手册要求每个实际完成的来源检索及时追加真实终态与证据；`started`、已尝试来源清单和候选数量均不能代替核验闭环。未完成来源保持真实缺口，不用批量标签关闭门禁。

这些修改补齐项目遇到宿主初始化错误后的恢复流程。此次 helper 根因修复已由普通沙箱和新日志另行验收；流程文字、宿主命令恢复与日报线上发布仍是三个不同的完成范围。

## 本次修改验证范围

项目文本仅修改上述两份流程文档并新增本报告；静态核对相对链接、工具字段、手册命令和现有状态枚举，运行 `git diff --check`。另在用户要求彻底修复同根因的范围内，经环境审批执行了上述宿主单文件修复和普通沙箱验收。不在本报告范围内初始化生产运行、取生产租约、检索新闻、构建、渲染、发布、提交或推送。现有调度和内容、时间、租约、审批门禁不变。
