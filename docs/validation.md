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

## 产品、报价、订单与经营统计验收（Issue #10，子任务 #11–#16）

日期：2026-10-03 至 2026-10-04；macOS Apple Silicon。使用独立验收应用标识和 SQLite 目录，仅录入虚构的 QA 客户、产品及供应商。实现候选 `a62c155`，随后补充最小窗口滚动条修复和验收测试。以下是整合主分支前的历史结果；最终 schema 4 及共用产品、控件的验证见文末「Issue #10 主分支整合验收」。

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

## 统一 Select 阶段验收（Issue #26，客户与跟进部分）

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

## 统一 Select 完整验收（Issue #26）

2026-10-04，macOS Apple Silicon；受测代码 `05fb8e1`，已集成 PR #41 的合并提交 `525e502`。本节补齐此前阶段验收中等待依赖的知识库四个下拉，并记录最终集成后的复核。全部 12 处定义（14 处使用）已迁移，原有日期组件、业务 IPC 与 schema 保持不变。

### 自动验证与审查

- `pnpm test`：14 个文件、78 项通过。新增知识库真实 Radix 交互覆盖通用资料/数字 ID、归档回填、四项选择失败保留、保存期间及已提交状态禁用、编辑时类型锁定、切换类型清理已确认预览，以及迟到提取响应隔离。合入的日期表单测试通过真实 Select 操作选择下一阶段。
- `pnpm format:check`、`pnpm build`（含 TypeScript 检查）、`git diff --check`：通过。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`cargo test --manifest-path src-tauri/Cargo.toml --locked`、`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings`：通过，21 项 Rust 测试。使用独立构建目录，未修改 Rust 代码。
- `pnpm tauri build --debug --bundles app --config <独立验收配置>`：macOS Apple Silicon 调试 `.app` 构建并实际启动。正式配置 `pnpm tauri build --no-bundle` release 原生编译通过。
- 以 `525e502...05fb8e1` 的完整任务差异进行 Standards 与 Spec 两项独立审查，均 PASS，无未解决的有效发现。

### 最终 macOS WebView 验收

独立标识 `com.tradequill.issue26.validation` 的验收库从 schema 2 正常启动至 schema 3，保留原有 1 位合成客户、45 条询盘、报价与样品。补充 45 个合成产品，未使用正式应用数据。

- 知识资料新建时，Tab 到达关联产品，方向键、Home/End 和 Enter 可选通用资料或产品；Escape 关闭弹层并恢复触发器焦点。45 个产品可滚动，归档产品仍有说明，长中文及连续英文折行显示。
- 在 1280 × 820 和 900 × 600 浅/深主题下检查知识库下拉，并在最小窗口复验客户下拉。弹层随可用空间定位并在窗口内滚动；超高的客户产品选项可继续滚动至末尾。集成后的页面未见横向溢出，旧阶段记录中的横向滚动问题不再复现。页面滚动后仍能操作表单与保存按钮。
- 通过键盘设置 FAQ、已确认、对外可用，选择归档产品 SELECT-45。将独立验收库临时改为只读后，真实 IPC 保存显示 `attempt to write a readonly database`，四项选择和正文均保留；立即恢复原权限后重试成功。只读数据库核对 `product_id = 45` 且类型为 `integer`，`kind = faq`、`status = confirmed`、`visibility = public`。
- 编辑已保存资料时，归档关联、FAQ、确认状态与使用范围准确回填，资料类型入口禁用。改选通用资料保存新版本后，数据库 `product_id` 为 `NULL`，其他选择保留。
- 使用系统文件选择器导入合成 TXT，真实 Rust 提取并显示预览。显式确认后切换文本类型，再切回文件类型，旧预览和确认状态均清除、文件输入恢复为空；提交被“请选择文件并查看提取预览”拦截，不能复用旧预览。
- 客户长产品筛选后仅显示对应询盘；清除后恢复 45 条，清除按钮禁用。浅/深主题下复验弹层及 Escape 焦点返回，原有客户与业务流程的阶段性桌面证据见前节。

截图：[知识库浅色标准窗口](assets/validation/issue26/catalog-select-light-1280.png)、[知识库深色标准窗口](assets/validation/issue26/catalog-select-dark-1280.png)、[知识库浅色最小窗口](assets/validation/issue26/catalog-select-light-min.png)、[知识库深色最小窗口](assets/validation/issue26/catalog-select-dark-min.png)、[真实保存失败](assets/validation/issue26/catalog-select-save-failure.png)、[类型切换清理预览](assets/validation/issue26/catalog-select-preview-cleared.png)、[客户浅色最小窗口](assets/validation/issue26/customer-select-light-min.png)、[客户深色最小窗口](assets/validation/issue26/customer-select-dark-min.png)。全部仅含合成验收资料。

### 平台限制

Windows 实际 WebView 交互、字体、安装及系统窗口行为仍未执行；双平台远端 CI 以最终 PR head 检查为准，不能替代 Windows 人工验收。未生成或安装正式分发包，未执行签名、公证或额外部署。

## Issue #10 主分支整合验收

环境：2026-10-04，macOS Apple Silicon；整合主分支 `e5ba26a`，受测实现 `67c34c6`，类型兼容性修正后的候选 `6c6e132`。使用独立应用标识 `com.tradequill.issue10integration` 和合成资料。上文的 schema 3 交易验收属于旧候选，不能替代本节结果。

### 本地检查与审查

- `pnpm install --frozen-lockfile`、`pnpm format:check`、`pnpm build` 通过。`pnpm test` 在 `67c34c6` 通过 15 个文件、94 项；`6c6e132` 仅移除测试查询不支持的 `exact` 选项，随后主导航 4 项测试与完整类型检查/生产构建再次通过。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings` 通过；`cargo test --manifest-path src-tauri/Cargo.toml --locked` 通过 37 项。
- 新增回归使用冻结的真实 schema 3 产品/知识库结构，验证迁移至 schema 4、共享产品 ID 与资料保留、报价快照隔离、从 schema 2/3 失败时事务回滚，以及高版本拒绝降级。草稿订单切换报价修订时，失去产品关联的费用会阻止保存且不改变订单/审计；明确解除关联后可重试并保留金额。
- 前端新增共享 Select/日期控件、写入成功但刷新失败的恢复、交易编辑中主导航/模块导航的输入保护，以及产品交期范围和统一 MOQ 边界回归。
- `pnpm tauri build --debug --bundles app --config <隔离验收配置>` 在 900×600、1280×820 配置下均生成并启动调试 `.app`；正式配置 `pnpm tauri build --no-bundle` 的 macOS Apple Silicon release 原生编译通过。
- Standards 与 Spec 两项独立审查均完成修复复审：处理编辑中切换导航丢失输入、MOQ 校验分歧和订单修订留下无效费用产品关联。CI 保留主分支原有测试步骤，移除整合产生的重复执行。

### 真实桌面、PDF 与持久化

1. 从已发布的 schema 3 结构和合成旧客户/简单报价启动应用，迁移为 schema 4。产品与知识库入口将同一产品 `SHARED-QA` 的交期从 14 天改为 14–21 天；交易入口立即显示相同记录及原有含义「收到订金后」，供应商关联保留同一产品 ID。
2. 真实 UI 创建供应商及 USD 2.5000 供货参考价，选品生成 `QT-000001-R1`：100 × 5.1250 = 512.50，加客户运费 10，合计 USD 522.50。短暂持有隔离数据库排他锁时，真实 IPC 保存失败保留客户、日期和明细；编辑中的主导航和模块导航保持禁用，释放锁后成功重试，导航恢复。
3. 通过原生保存对话框导出双语 PDF，使用 Poppler 渲染并逐页目视检查，使用 pypdf 核对一页文本。中文参数、交期含义、数量、单价、条款及 USD 522.50 合计一致；未包含供应商、内部备注或成本。旧候选的多页回归记录见上文，当前 Rust PDF 测试继续通过。
4. 报价转 `SO-000001`，草稿补充交付日期 `2026-10-25`，确认后销售冻结；未知成本仍显示待计算。调用参考价生成待确认采购 250.00，核实后确认并录入实际运费 20.00；明确其余费用为零后，总费用 270.00、利润 252.50、利润率 48.33%。
5. 统计起止均设为 `2026-10-04`，纳入 1 个已确认订单。成本完整分组下钻并打开订单后，收入、费用、利润一致。
6. 退出并重启调试应用后，共享产品、供货关联、报价、已确认订单、交付日期及成本均保留。只读核对 schema 为 4，`integrity_check=ok`，旧客户/询盘/简单报价保留，订单有创建、交付日期修改、确认及成本更正 4 条审计快照。
7. 900×600 和 1280×820 均核对浅/深主题，无页面横向滚动条。最小窗口日期弹层可达，方向键后 Escape 保留原日期并返回触发器；Select 方向键和 Enter 可选运费分类，Escape 保留旧选项，Tab 到达下一日期字段且焦点可见。加载、刷新失败及重试状态由本次真实控件集成测试覆盖。

截图均为原生 WebView 和合成资料，Retina 像素尺寸为逻辑窗口的 2 倍：[标准窗口浅色](validation/issue10/integration-product-light-1280.png)、[标准窗口深色](validation/issue10/integration-product-dark-1280.png)、[最小窗口空状态](validation/issue10/integration-empty-light.png)、[最小窗口真实保存失败](validation/issue10/integration-save-failure-light.png)、[日期弹层](validation/issue10/integration-calendar-light.png)、[订单利润](validation/issue10/integration-profit-light.png)、[深色统计](validation/issue10/integration-report-dark.png)、[深色键盘焦点](validation/issue10/integration-keyboard-dark.png)。

### 未验证与升级边界

- Windows 实机 UI、原生保存对话框、安装包安装和 macOS Intel 实机未执行；远端跨平台编译/测试以关联 PR 最新 head 的 Checks 为准，历史成功不算本次结果。
- 未执行正式签名、公证、发行安装包、自动更新或额外部署。
- schema 4 复用已发布产品表并追加交易结构，保留知识库数据；不支持原地降级。升级前完整备份应用数据目录，回退时恢复升级前备份，不修改 `user_version` 绕过保护。
