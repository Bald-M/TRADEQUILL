# 框架验收记录

环境：macOS Apple Silicon；Node 22.22.2、pnpm 11.19.0、Rust 1.98.0。

## 已通过

- `pnpm install --frozen-lockfile`：锁定依赖安装。
- `pnpm build`：TypeScript（应用及 Vite 配置）检查和 Vite 生产构建。
- `pnpm format:check`、`cargo fmt --manifest-path src-tauri/Cargo.toml --check`。
- `pnpm check:rust`：Clippy 全目标，警告视为错误。
- `pnpm tauri build --debug --bundles app`：生成本机可启动的 macOS `.app` 调试包。
- 实际 `.app` 启动，SQLite 初始化成功；设置页显示真实数据目录、附件目录和 schema 版本 1。
- SQLite `integrity_check` 为 `ok`；退出并重新启动应用后，数据库 SHA-256 未变，主题偏好保留。
- 界面预览在 1280 和 900×600 尺寸检查；导航、业务占位说明、浅/深主题、浏览器环境提示及重试正常，控制台无 error/warn。
- 键盘 Tab 可到达主题按钮；提供跳到主要内容链接和减弱动态效果样式。
- Standards 与 Spec 两项独立静态审查：初始候选均无发现，依赖修正后做增量复审。
- [GitHub Actions 桌面检查](https://github.com/Bald-M/TRADEQUILL/actions/runs/36310571742)：Windows 与 macOS 的格式、前端构建、Rust 格式、Clippy 及 Tauri 无安装包构建全部通过。
- `pnpm desktop:build:all --ref main`：[首次远端安装包构建](https://github.com/Bald-M/TRADEQUILL/actions/runs/36310990140)成功生成并下载 Windows x64 的 MSI/NSIS、macOS Apple Silicon DMG 和 macOS Intel DMG。

## 依赖修正

初始模板解析出了 Tauri 2.12 Rust 核心，但 npm API 仍为 2.11，打包器拒绝这一组合。只降级核心仍会混入不兼容的 2.12 runtime，编译失败。最终使用 2.11 系列 core/runtime，配套 2.6.3 build/macros/codegen 和 2.9.3 utils，已记录在 Cargo.lock。

## 尚未验证或未实现

- Windows 与 macOS 安装包的实机安装和启动验收；当前仅记录 macOS Apple Silicon 调试 `.app` 的实机运行结果。
- Windows 签名、macOS 正式签名与公证、正式分发、自动更新。
- 业务数据导入导出及完整备份恢复。
- ask-matt 的 Issue tracker 与领域文档布局尚未完成项目级配置。

## 客户业务闭环验收（Issue #3）

环境：macOS Apple Silicon；2026-09-27，在隔离的应用标识和数据目录中执行，验收后将临时数据与应用包移入废纸篓。

### 自动验证

- `pnpm test`：Vitest 通过 6 个测试文件、19 个测试，覆盖产品名归一化、询盘组合筛选、筛选后的详情一致性、筛选与编辑记录切换、表单及任务状态写入成功但刷新失败时的集成恢复和重复提交防护、跨日任务重分组、并发提醒检查合并、通知投递成功/失败时的去重语义、待办日期分组，以及客户表单校验和成功提交。
- `pnpm typecheck`、`pnpm build`：TypeScript 检查与 Vite 生产构建通过。
- `cargo test --manifest-path src-tauri/Cargo.toml`：6 个存储层测试通过，覆盖完整业务闭环与重复启动、跨客户引用拒绝、样品状态与日期约束、每日提醒去重、高版本 schema 拒绝降级。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`pnpm check:rust`：Rust 格式和 Clippy 全目标检查通过。
- `pnpm tauri build --debug --bundles app`（使用隔离的验收应用配置）：macOS Apple Silicon 调试 `.app` 构建通过。

### 实际桌面验收

- 创建客户、询盘（两个产品）、USD 报价、样品和当日跟进；客户详情的询盘、报价、样品与待办页签均同步展示。
- 全局业务页显示当日任务和日历日期；完成任务后“今日”从 1 变为 0，“已完成”变为 1，日历条目同步为完成状态。
- 关闭并重新打开 `.app` 后，客户、询盘、报价、样品和已完成任务均保留；设置页显示隔离数据目录和 schema 版本 2。
- 在浅色和深色主题、1280×820 和最小窗口 900×600 下检查客户与全局业务界面，无横向溢出；键盘 Tab 焦点可见。

### 本次未验证

- Windows 实机运行与安装包安装。
- macOS 系统通知权限提示和通知投递未在人工验收中触发；提醒的到期判定、每日一次去重和 IPC 已由自动测试及本机构建覆盖。

## 统一 Select 验收（Issue #26，客户与跟进部分）

环境：macOS Apple Silicon，2026-10-04；候选提交 `10a6580`。使用独立应用标识和数据库目录的调试 `.app`，只使用合成记录。产品知识库四个下拉等待 #11/#23 合入目标分支后继续迁移，本节不代表整个 #26 已完成。

### 自动验证

- `pnpm typecheck`、`pnpm format:check`、`pnpm build`：通过。
- `pnpm test`：7 个文件、37 个测试通过；长文本包装调整后，共享 Select 的 4 项测试及构建再次通过。新增真实 Radix 交互覆盖空值往返、数字 ID 和前缀文本值、动态选项回填与删除、disabled 与错误描述、方向键/Enter/Escape/Tab 和焦点恢复、四维组合筛选/无结果/清除、旧记录回填、失败保留及合法样品下一阶段。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`pnpm check:rust`：通过；`cargo test --manifest-path src-tauri/Cargo.toml --locked`：6 项通过。本次未修改 Rust、IPC 或数据库 schema。
- `pnpm tauri build --debug --bundles app --config <独立验收配置>`：本机调试 `.app` 构建与启动通过；`pnpm tauri build --no-bundle`：正式配置的 macOS Apple Silicon release 原生编译通过。未验证安装包或正式签名。
- Standards 与 Spec 两项独立审查：客户/跟进范围无有效发现；产品部分完成后需要增量复审。

### 实际桌面验收

- 浅/深主题与 1280 × 820、900 × 600 窗口下检查统一弹层。45 个产品选项可滚动，长名称与连续英文可完整折行；最小窗口弹层可翻转至触发器上方，页面滚动后的样品选择也可到达。
- 键盘定位并确认长选项后，询盘历史只显示匹配记录；Escape 返回选择触发器，Tab 到达下一个筛选，恢复空项后清除筛选按钮禁用。
- 样品未选下一阶段时显示关联字段错误。选“准备中”后错误清除，经真实 IPC 保存后历史更新，下一组选项变为“已寄出/已取消”。
- 将独立验收数据库临时设为只读，报价保存失败时仍保留 `EUR`、不关联询盘、金额和内容；恢复写权限后重试成功。只读核对数据库为 `EUR`、4200 分、`inquiry_id = NULL`，样品为 `preparing`，`integrity_check` 为 `ok`。
- 当前旧基线最小窗口仍有页面横向滚动条；待产品基础合入后的最终窗口验收另行复核，不能把中间候选描述为没有溢出。

界面证据：[长选项浅色](assets/validation/issue26/select-long-light.png)、[长选项深色](assets/validation/issue26/select-long-dark.png)、[最小窗口浅色](assets/validation/issue26/select-min-light.png)、[最小窗口深色](assets/validation/issue26/select-min-dark.png)、[样品字段错误](assets/validation/issue26/select-stage-error.png)、[报价保存失败](assets/validation/issue26/select-save-failure.png)。

### 待完成

- #11/#23 合入后迁移并验证产品关联、资料类型、确认状态和使用范围。
- 最终提交的完整检查、两项本地复审与远端 CI。
- Windows 实机 WebView、安装和正式签名尚未验证。
