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

## 产品档案与离线知识库验收（Issue #11 / #23，Epic #17 基础）

环境：macOS Apple Silicon；2026-10-03，分支 `codex/issue-17-ai-workflows`。使用独立应用标识的调试 `.app` 和合成产品/PDF，未读取真实客户资料。这里记录产品档案和离线资料管理，不能作为整个 Epic #17 的完成证据。

### 自动验证

- `pnpm install --frozen-lockfile --offline`、`pnpm build`、`pnpm format:check`：通过。
- `pnpm test`：9 个文件、33 个测试通过。新增覆盖产品表单校验、归档和复制，资料预览确认、版本编辑、筛选范围、加载/失败恢复、取消与迟到响应、写入成功后刷新失败的重复提交防护。
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`：18 个测试通过。新增覆盖产品数值与编号约束、资料版本与文件去重、空库/超限/无效文本、预览过期、并发版本冲突、删除后的检索与引用失效、总容量拒绝写入且保留旧版本，以及 schema 2 历史业务保留和迁移失败回滚；原有业务闭环与高版本 schema 拒绝降级测试继续通过。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`pnpm check:rust`：通过。
- `pnpm tauri build --debug --bundles app --config <隔离验收配置>`：生成并实际启动 macOS Apple Silicon 调试 `.app`。这不是 Windows 构建、签名或安装包验收。

### 实际桌面验收

- 创建 `WIDGET-A` 合成产品，设置名称/值参数、MOQ `100 pcs` 和交期 `14 天（确认订单后至发货）`；详情与复制资料一致。
- 通过本机文件选择器导入一页含文本的 PDF，真实 Rust 子进程提取原文；检查来源、产品关联、标签、确认状态和公开范围后显式确认保存。
- 搜索 `MOQ` 返回当前版本的匹配片段与页码；点击结果打开 PDF 第 1 页提取文字。无匹配词返回明确空状态。
- 退出并重新启动 `.app` 后，产品、已导入 PDF、提取文字及主题偏好保留，数据库为 schema 3。
- 损坏 PDF 的实际导入被拒绝，显示失败原因并保留已输入标题/来源；取消导入后原有资料仍在。
- 浅/深主题及 900 × 600 最小窗口下检查产品、检索与失败界面，无横向滚动条；导航区可独立滚动。键盘 Tab 焦点可见，并可用键盘打开文件选择器。

界面证据：[知识库浅色](assets/validation/issue17/knowledge-light.png)、[知识库深色](assets/validation/issue17/knowledge-dark.png)、[最小窗口浅色](assets/validation/issue17/product-min-light.png)、[最小窗口深色](assets/validation/issue17/product-min-dark.png)、[PDF 失败](assets/validation/issue17/pdf-failure-min.png)、[检索空状态](assets/validation/issue17/search-empty-min.png)。失败截图记录实际流程，之后仅修正了错误提示的重复句号。

### 尚未完成的验收与范围

- Windows 实机运行、安装及本次远端 CI；本节仅记录已执行的本地检查，历史 CI 结果不能替代本次结果。
- #18 服务配置、#21 公开线索搜索、#22 评估与转客户、#24 有据问答、#25 竞品报告尚未实现，等待首个模型/搜索服务及业务规则选择。没有执行真实模型或搜索服务验收。
- #19/#20 仍为后续可选沟通需求。扫描 PDF 的 OCR、音视频、向量数据库和自动营销不在本阶段范围。
