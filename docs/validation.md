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

## 产品、报价、订单与经营统计验收（Issue #10，子任务 #11–#16）

日期：2026-10-03 至 2026-10-04；macOS Apple Silicon。本次使用独立验收应用标识和 SQLite 目录，仅录入虚构的 QA 客户、产品及供应商。实现候选 `a62c155`，随后补充最小窗口滚动条修复和验收测试；精确交付版本以关联 PR 的 head 为准。以下记录是本次结果，上文为历史结果。

### 自动验证

- `pnpm test`：7 个测试文件、32 项通过。新增覆盖精确小数字符串、内部备注隔离、保存失败保留输入、保存成功后只重试刷新、供货编辑双向档案切换保护、订单版本冲突的显式核对与重试，以及统计加载/失败/重试。
- `pnpm format:check`、`pnpm build`、`cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`pnpm check:rust` 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml --locked`：18 项通过，覆盖 schema 2 兼容、schema 3 事务回滚、重复启动及高版本拒绝；目录唯一性和归档；旧报价显式补全与不可变修订；并发转单去重、取消重开与审计快照；参考价格变更隔离；金额舍入、JPY、外币汇率、缺失成本、零收入、负利润及分币种日期边界统计。
- `pnpm tauri build --debug --bundles app --config <隔离验收配置>`：生成并启动本机 macOS Apple Silicon 调试 `.app`。分别使用 1280×820、900×600 配置，不修改正式应用标识。
- PDF 自动回归生成单页与四页中文长资料样例，逐页渲染检查未见重叠、截断或乱码；提取文本核对中文、金额与内部信息排除。包含不支持字符、非 PDF 后缀、目标目录不存在及原文件保留检查。

### 实际桌面链路

1. 创建客户 QA Demo Buyer、产品 QA-001（中文名、容量 300 ml、MOQ 100、确认后 7–14 天）和供应商 QA Supply。供应商关联产品，保存 USD 2.5000 参考单价与 2026-10-03 日期；失败后输入保留，补齐后成功重试。
2. 从产品档案选品，输入数量 100、单价 5.1250、客户运费 10、有效期和双语抬头/条款。Rust 保存 `QT-000001-R1`，行金额 512.50、总额 USD 522.50。
3. 通过原生保存对话框取消 PDF 导出，显示取消反馈；重试成功导出 PDF。文本核对中文、数量、单价及总额，与页面一致，不包含产品内部备注、供应商或订单成本。
4. 从报价版本创建 `SO-000001`，确认订单后销售信息冻结。未录入成本时显示待补全、待计算，没有把未知成本视作零。
5. 调用供货参考价生成 USD 250.00 的待确认采购草稿，核实金额后确认，并录入 USD 20.00 实际运费。明确其余费用为零、成本完整后保存：总费用 270.00、利润 252.50、利润率 48.33%。
6. 统计 2026-10-01 至 2026-10-04，纳入 1 单，USD 收入 522.50、利润 252.50；点击成本完整分组下钻，再打开构成订单，金额完全一致。
7. 多次退出并重新打开 `.app`，客户、目录、供货关联、报价、订单状态与成本保留。SQLite schema 为 3，`integrity_check` 为 `ok`，订单审计包含创建、确认与成本更正三次快照。
8. 浅色/深色及 900×600 最小窗口检查通过；修复页面最小宽度与系统滚动条叠加造成的横向滚动。Tab 可到达归档复选框，Space 可切换，Tab/Enter 可打开产品表单，焦点可见。重复编号的错误提示清晰且输入保留。统计加载状态由延迟 IPC 的前端测试覆盖。

### 截图与审查

仅含虚构验收数据，原生 WebView 截图使用 Retina 像素尺寸（像素宽高均为逻辑窗口尺寸的 2 倍）。

- [浅色空状态](validation/issue10/empty-light.png)
- [深色订单利润](validation/issue10/order-dark.png)
- [统计和下钻](validation/issue10/report-dark.png)
- [900×600 深色与键盘焦点](validation/issue10/minimum-dark-keyboard.png)
- [900×600 浅色失败输入保留](validation/issue10/minimum-light-failure.png)

Standards 与 Spec 两项独立审查及修复复审通过：修复供货表单跨档案保留旧上下文、订单版本冲突缺少恢复入口，以及确认状态恢复边界。仓库自动审查指出的旧报价重复转换已通过前端入口约束与后端并发事务保护修复，新增并发转换测试。macOS 调试包内核对字体许可证及来源说明随包分发。最小窗口样式与本节记录另作增量审查。

### 本次未验证与边界

- Windows 实机操作、原生保存对话框和安装包安装；macOS Intel 实机运行。跨平台 CI 编译/测试结果以 PR 当前 head 的检查记录为准。
- 正式签名、公证、发行安装包及自动更新。
- 本次利润是经营测算，未实现退款退货、现金流、完整会计、库存或采购单；无在线汇率、云同步、AI 或自动对外发送。
- schema 3 不支持原地降级。升级前备份完整应用数据目录；需要回退旧版本时恢复升级前备份，不修改 `user_version` 绕过保护。
