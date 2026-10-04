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
- 框架验收时 ask-matt 尚未配置；2026-10-04 已补齐 [Issue tracker](agents/issue-tracker.md)、[分流标签](agents/triage-labels.md) 和 [领域文档读取规则](agents/domain.md)。这不代表相关功能需求已实现。

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

环境：macOS Apple Silicon；2026-10-03 至 2026-10-04，分支 `codex/issue-17-ai-workflows`。使用独立应用标识的调试 `.app` 和合成产品/PDF，未读取真实客户资料。这里记录产品档案和离线资料管理，不能作为整个 Epic #17 的完成证据。

### 自动验证

- `pnpm install --frozen-lockfile --offline`、`pnpm build`、`pnpm format:check`：通过。
- `pnpm test`：10 个文件、39 个测试通过。新增覆盖产品表单校验，资料预览确认、版本编辑、筛选范围、加载/失败恢复、取消与迟到响应、写入成功后刷新失败的重复提交防护，以及主导航在产品/资料编辑、保存中和保存失败时的输入保护。103 个产品和资料缓存未刷新时的全部/手选范围检索有回归用例。产品归档由 Rust 测试覆盖，资料复制由实际桌面验收覆盖。
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`：20 个测试通过。新增覆盖产品数值与编号约束、资料版本与文件去重、空库/超限/无效文本、预览过期、并发版本冲突、删除后的检索与引用失效、总容量拒绝写入且保留旧版本，以及 schema 2 历史业务保留和迁移失败回滚；原有业务闭环与高版本 schema 拒绝降级测试继续通过。全部产品范围检索覆盖 103/104 个产品、新建/更正资料和归档过滤；缺省范围标志及空 ID 不隐式扩大检索范围。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`pnpm check:rust`：通过。
- `pnpm tauri build --debug --bundles app --config <隔离验收配置>`：生成并实际启动 macOS Apple Silicon 调试 `.app`。这不是 Windows 构建、签名或安装包验收。
- `pnpm tauri build --no-bundle`：正式配置的 macOS Apple Silicon release 原生可执行文件构建通过，初始候选 `81b420f`、导航保护及检索范围修复后均已执行。无安装包生成或签名。
- Standards 与 Spec 两项独立本地审查：修复主导航丢弃未保存输入与测试覆盖文案后，离线 #11/#23 无未解决发现。完整 Epic 的 AI 部分仍未交付。

### 实际桌面验收

- 创建 `WIDGET-A` 合成产品，设置名称/值参数、MOQ `100 pcs` 和交期 `14 天（确认订单后至发货）`；详情与复制资料一致。
- 通过本机文件选择器导入一页含文本的 PDF，真实 Rust 子进程提取原文；检查来源、产品关联、标签、确认状态和公开范围后显式确认保存。
- 搜索 `MOQ` 返回当前版本的匹配片段与页码；点击结果打开 PDF 第 1 页提取文字。无匹配词返回明确空状态。
- 退出并重新启动 `.app` 后，产品、已导入 PDF、提取文字及主题偏好保留，数据库为 schema 3。
- 损坏 PDF 的实际导入被拒绝，显示失败原因并保留已输入标题/来源；取消导入后原有资料仍在。
- 浅/深主题及 900 × 600 最小窗口下检查产品、检索与失败界面，无横向滚动条；导航区可独立滚动。键盘 Tab 焦点可见，并可用键盘打开文件选择器。
- 导航保护修复后的实际 `.app` 中，填写新产品后尝试点击客户管理，表单和输入仍保留；点击取消后主导航恢复，能够进入客户管理。
- 检索范围修复后的实际 `.app` 中，全部产品检索 `MOQ` 返回原有 PDF 片段；取消全部产品、手选 `WIDGET-A` 并排除通用资料后仍返回该产品的真实来源片段。超过 100 产品及陈旧缓存边界由上述回归测试覆盖。

界面证据：[知识库浅色](assets/validation/issue17/knowledge-light.png)、[知识库深色](assets/validation/issue17/knowledge-dark.png)、[最小窗口浅色](assets/validation/issue17/product-min-light.png)、[最小窗口深色](assets/validation/issue17/product-min-dark.png)、[PDF 失败](assets/validation/issue17/pdf-failure-min.png)、[检索空状态](assets/validation/issue17/search-empty-min.png)、[编辑导航保护](assets/validation/issue17/edit-navigation-min.png)。失败截图记录实际流程，之后仅修正了错误提示的重复句号。

### 尚未完成的验收与范围

- Windows 实机运行与安装；远端 CI 结果以本次 PR 最新提交的检查为准。本节记录本地验证，历史 CI 结果不能替代本次结果。
- #18 服务配置、#21 公开线索搜索、#22 评估与转客户、#24 有据问答、#25 竞品报告尚未实现，等待首个模型/搜索服务及业务规则选择。没有执行真实模型或搜索服务验收。
- #19/#20 仍为后续可选沟通需求。扫描 PDF 的 OCR、音视频、向量数据库和自动营销不在本阶段范围。

## 共用日期与本地时间入口（Issue #27）

环境：2026-10-04，macOS Apple Silicon，独立验收应用标识 `com.tradequill.validation.issue27`；只使用 Date QA 等测试资料。基点为 `24a5ebe`，本节记录 #27 分支中含同步日历焦点和错误文案去重修复的代码，未使用其他任务的未提交内容。

### 自动验证

- `pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm build`、`pnpm format:check` 通过。
- `pnpm test`：9 个文件、35 项测试通过。覆盖五个表单的回填、清空必填、非法日期拦截、失败保留与重试；日历精确筛选、原有跨日分组；日期键盘编辑、跨年选取、立即 Enter 焦点回归、Escape/取消/遮罩、小时分钟、禁用和外部值更新。
- 以 `TZ=America/Los_Angeles`、`TZ=Pacific/Kiritimati`、`TZ=Pacific/Apia` 分别执行 `pnpm exec vitest run src/lib/date-input.test.ts src/components/ui/date-time-field.test.tsx src/components/business/BusinessDates.test.tsx`：各 15 项通过。覆盖午夜、UTC 两侧日期和夏令时缺失/重复墙上时间，不作 UTC 转换。星期计算采用纯 Gregorian 日历天数，另覆盖 Apia 曾跳过的 `2011-12-30`。这是自动行为测试，不是这些地区的实机验收。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`pnpm check:rust`、`cargo test --manifest-path src-tauri/Cargo.toml --locked` 通过（6 个存储测试）。Rust 源码、IPC 和 SQLite schema 未修改。
- `pnpm tauri build --debug --bundles app --config <临时验收配置>` 通过，使用独立构建目录。配置仅覆盖产品名、应用标识与窗口初始尺寸，生成 macOS Apple Silicon 调试 `.app`；不代表签名、公证或安装包分发验收。

### macOS 真实 WebView 验收

- 询盘日期 `2026-12-31` 打开后方向键跨年、Enter 选取，Escape 保留原值，焦点回到打开按钮；保存询盘并重启后日期不变。
- 跟进时间从 `2026-12-31T23:59` 跨年选至 `2027-01-01`，设置小时/分钟为 `00:05` 后回填、保存，业务页和日历均显示 `2027-01-01 00:05`；再次启动并编辑时回填一致。
- 发现并修复连续方向键/Enter 可能赶在异步焦点更新前选择错误日期的问题；最终同步焦点实现经实机复验和自动回归测试通过。
- 1280×820 和 900×600 均检查浅/深主题。日历与时间弹层完整处于窗口内，六周月份及时间错误导致内容增高时可以内部滚动，取消/应用可达；Tab 焦点可见，Escape 退出。
- 小时 `24` 显示范围错误并禁用应用；非法日期文本提交被拦截、草稿保留，错误提示不重复。清空日历日期显示“请选择有效日期查看安排”，不混入全部任务。
- 短暂对独立验收数据库持有排他锁，真实 IPC 保存返回 `database is locked`；日期草稿 `2027-01-03T00:05` 保留，保存中入口禁用，释放锁后重试成功并显示正确日期。锁已释放，无测试数据写入正式应用目录。
- 最小窗口页面沿用已有 `body` 的 900px 最小宽度，出现系统纵向滚动条时仍可能有页面级横向滚动条；日期弹层本身未超出窗口。本票未更改全局布局约束。

截图：[浅色 1280](assets/validation/issue27/light-1280.png)、[深色 1280](assets/validation/issue27/dark-1280.png)、[浅色 900](assets/validation/issue27/light-900.png)、[深色 900](assets/validation/issue27/dark-900.png)、[时间错误与禁用](assets/validation/issue27/error-900.png)、[真实保存失败保留输入](assets/validation/issue27/save-failure-900.png)、[清空日期](assets/validation/issue27/empty-900.png)。

### 本次未验证

- Windows 实际 WebView 交互、字体与系统窗口表现；双平台 CI 编译成功不能替代 Windows 人工验收。
- Windows/macOS 正式安装包安装、签名与公证。本次未触发额外发布或部署。

## PR #41 离线功能交付复核

2026-10-04，macOS Apple Silicon。将 `main` 的日期控件和需求流程文档（`464aaf1`）集成到产品知识库分支，保留两边的更新日志与历史验收记录。受测代码为 `3fe3356`，本节补充本次复核，不将前面的历史结果当作本次检查。

- `pnpm format:check`、`pnpm build`、`pnpm test`：通过，13 个文件、55 项前端测试；前端代码随后未改动。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`cargo test --manifest-path src-tauri/Cargo.toml --locked`、`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`：通过，21 项 Rust 测试。共享构建目录曾因缺失依赖产物导致文档测试失败，改用独立 `CARGO_TARGET_DIR` 后完整测试与 Clippy 均通过。
- Standards 全量审查通过；Spec 全量审查发现多个关键词分散命中标题、标签和正文时，片段可能缺少正文命中位置。修复后两项增量复审均通过。新增保存→检索回归在原实现失败、修复后通过，覆盖千字后命中、大小写、中文和 `İ` 小写扩展字符的原文定位。
- 修复后的隔离 macOS 调试 `.app` 构建并实际运行；正式配置的 `pnpm tauri build --no-bundle` release 原生编译通过。
- 真实桌面中原有合成产品参数、MOQ、交期和 PDF 保留；检索 `MOQ` 仍能打开第 1 页原文。通过界面保存一份长文本，退出后用修复包重新打开，检索 `specification sample-tag STEEL` 返回正文后段的 `Steel 本地资料`，保留原文大小写和上下文。Tab 到达结果，Enter 打开资料并将焦点定位到对应页。
- 900 × 600 浅/深主题下，长片段换行且可随页面滚动，无页面横向溢出。业务页的新日历弹层仍在窗口内，Escape 保留日期并恢复触发按钮焦点。

本次新增截图：[匹配片段浅色](assets/validation/issue17/snippet-light-min.png)、[匹配片段深色](assets/validation/issue17/snippet-dark-min.png)、[日历集成](assets/validation/issue17/date-integration-min.png)。截图仅含隔离验收库中的合成资料。

Windows 实际 WebView、安装包安装、签名和公证仍未执行；远端 CI 以最终 PR head 为准。此 PR 仅交付 #11/#23，#17 的在线 AI 需求保持未完成。
