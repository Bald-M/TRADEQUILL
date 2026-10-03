# Changelog

本文件记录 TradeQuill 的重要变更。

格式参考 [EasyDeployMesh](https://github.com/Bald-M/EasyDeployMesh/blob/main/CHANGELOG.md) 的分类结构及 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)。当前项目版本为 `0.1.0`，尚未正式发布；已完成的开发变更统一记录在 `Unreleased` 下，正式发布时再按版本及实际发布日期归档。

## Unreleased

### Added

- 产品档案：编号、参数、MOQ、交期、检索、复制和归档，保留现有业务自由文本。
- 轻量知识库：文本/FAQ、TXT/Markdown/含文本 PDF 的预览确认录入、范围与标签检索、资料版本、归档及内容删除；全部支持离线使用。
- SQLite schema 3 事务迁移与资料业务 IPC，受控文件副本保存在 SQLite；PDF 解析有文件大小、页数与耗时上限。

- 本地客户业务主线：客户档案、同客户多次询盘、来源/国家/产品/阶段组合筛选，以及客户卡片中的报价、样品和跟进历史。
- SQLite schema 2 事务迁移与明确 Rust 业务 IPC；覆盖跨客户关联拒绝、样品阶段历史、重复启动保留数据及高版本拒绝降级。
- 今日/逾期/后续/已完成待办、按日期查看和每日 09:00 本机系统提醒；权限或发送失败时保留应用内待办。
- Rust 业务数据测试与前端筛选、日期分组和表单交互测试。
- GitHub 远端仓库、Apache License 2.0，以及 Windows/macOS 安装包构建工作流。
- `pnpm desktop:build:all`：触发远端矩阵构建、等待完成并下载所有安装包。
- 中英文 README 项目封面，包含项目图标、内容导航、状态徽章和语言切换入口。
- 贡献指南，涵盖开发流程、验证、数据安全与问题反馈要求。
- 中英文 README 与双向语言切换链接。
- 基于 Tauri 2、React、TypeScript、Vite、Tailwind CSS 4 和 shadcn/ui（Radix）的桌面应用基础框架，面向 Windows 和 macOS。
- 工作台、客户管理、业务管理、数据管理与设置的统一导航；尚未实现的业务模块明确标注为“规划中”。
- 浅色与深色主题切换，首次未保存偏好时读取系统主题，后续使用本机保存的外观偏好。
- 本地工作空间初始化，创建 SQLite 数据库、应用元数据表和附件目录；设置页显示真实数据库位置、附件目录及 schema 版本。
- 工作空间连接中的状态提示、失败后的重试入口，以及浏览器预览环境下需要桌面应用的明确提示。
- 键盘跳转至主要内容、导航选中状态、图标按钮可访问名称和减少动态效果支持。
- 本地打包字体，以及统一的按钮、卡片、徽章与分隔线组件。
- 前端类型检查、格式检查、生产构建及 Rust 格式检查和 Clippy 命令；配置 Windows/macOS GitHub Actions 检查工作流。
- 项目运行说明、框架范围和历史验收记录，以及 `AGENTS.md` 开发约定与 `DESIGN.md` 设计规范。

### Fixed

- 对齐 Tauri Rust 核心、运行时及前端 API 的兼容版本，并锁定配套依赖，修复混用 Tauri 2.11/2.12 依赖造成的编译与打包失败。

### Security

- 业务数据访问集中在 Rust IPC 边界，前端未获授任意 SQL、文件路径读写或直接数据库访问能力。
- 生产 CSP 限制资源加载与连接来源，仅允许所需的本地资源和 Tauri IPC。
- SQLite 初始化迁移使用事务和 schema 版本检查；拒绝打开高于当前支持版本的数据，避免降级覆盖。
- 第一版不接入在线 AI、云端同步、遥测或远程字体；数据保留在本机。

### Known limitations

- 数据导入、导出、完整备份及恢复尚未实现；数据库尚无应用层加密。
- 客户、询盘及业务历史暂不提供删除/恢复；报价编辑只用于纠正录入错误，商业修订应新建报价记录。
- 系统提醒依赖应用正在运行或重新打开；应用完全退出后不在后台发送通知，也不提供云端或跨设备推送。
- 已记录 macOS Apple Silicon 调试 `.app` 的构建与启动验证；GitHub Actions 已验证 Windows x64、macOS Apple Silicon 和 macOS Intel 安装包构建。Windows 与 macOS 安装包仍待实机安装验收，具体证据见 [验收记录](docs/validation.md)。
- Windows 包尚未签名；macOS 包使用临时签名但尚未公证。正式分发和自动更新尚未配置。
- 安装包工作流已完成首次远端运行验证；新增业务主线具备 Rust 和前端自动化测试，但跨平台实机验收仍按上述范围记录。
