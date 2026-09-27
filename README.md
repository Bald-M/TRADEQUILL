<div align="center">
  <img src="src-tauri/icons/icon.png" width="132" alt="TradeQuill 图标">

  <h1>TradeQuill</h1>

  <p>
    本地优先的个人外贸桌面工作台，面向 Windows 和 macOS。<br>
    逐步整理客户资料、业务跟进和本地数据。
  </p>

  <p>
    <a href="#当前范围">当前范围</a> ·
    <a href="#开发环境">快速开始</a> ·
    <a href="#项目结构">项目结构</a> ·
    <a href="#本地数据">本地数据</a> ·
    <a href="#安全与扩展边界">安全</a> ·
    <a href="DESIGN.md">设计文档</a> ·
    <a href="CONTRIBUTING.md">参与贡献</a> ·
    <a href="CHANGELOG.md">更新日志</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/VERSION-0.1.0-0284c7?style=for-the-badge&amp;labelColor=525252" alt="版本：0.1.0">
    <img src="https://img.shields.io/badge/STATUS-IN%20DEVELOPMENT-16a34a?style=for-the-badge&amp;labelColor=525252" alt="状态：开发中">
  </p>
  <p>
    <img src="https://img.shields.io/badge/DESKTOP-macOS%20%7C%20Windows-a3aab8?style=for-the-badge&amp;labelColor=525252" alt="桌面平台：macOS 和 Windows">
    <img src="https://img.shields.io/badge/STACK-Tauri%20%7C%20React-06b6d4?style=for-the-badge&amp;labelColor=525252" alt="技术栈：Tauri 和 React">
    <img src="https://img.shields.io/badge/DATA-Local%20%7C%20SQLite-6366f1?style=for-the-badge&amp;labelColor=525252" alt="数据：本地 SQLite">
  </p>

  <p>
    <strong>简体中文</strong> · <a href="README.en.md"><code>English</code></a>
  </p>
</div>

## 当前范围

这是可继续开发的基础框架，包含 Tauri 2、React、TypeScript、Vite、Tailwind CSS 4、shadcn/ui（Radix）、主题切换、模块导航及 Rust + SQLite 初始化。

客户管理、业务管理、导入导出、完整备份目前是明确标注的占位页面，尚无业务 CRUD。第一版不接入 AI、云端同步、遥测或远程字体。不需要数据库服务器。

## 开发环境

- Node.js 22.12+（推荐 Node.js 22 LTS）、pnpm 11.19.0。
- Rust stable，包含 rustfmt 和 clippy。
- macOS：Xcode Command Line Tools (`xcode-select --install`)。
- Windows：Microsoft C++ Build Tools（Desktop development with C++）、WebView2。
- 各平台原生构建；在 Windows 上构建 Windows 安装包，在 macOS 上构建 macOS 包。

详细依赖见 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。

```sh
pnpm install --frozen-lockfile
pnpm desktop:dev
```

`pnpm dev` 仅用于开发时预览界面，会明确提示无法连接桌面数据库。正式产品是 Tauri 桌面应用，不部署网站。

## 常用命令

```sh
pnpm typecheck
pnpm format:check
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
pnpm check:rust
pnpm desktop:build
```

构建产物位于 `src-tauri/target/release/bundle/`。目前不配置发布签名、公证、自动更新或在线发布；默认包只用于本地开发验证。Windows/macOS 检查工作流已经配置，连接 GitHub 远端后才会运行。

Tauri 的 Rust 核心与前端 API 固定在 2.11 系列，间接依赖以 `Cargo.lock` 为准。升级时一并验证 Tauri core/runtime/macros/build/codegen/utils，不要单独删除锁文件或只升级其中一个包。

添加 shadcn 组件：

```sh
pnpm exec shadcn add input dialog table
```

## 项目结构

- `src/App.tsx`：桌面导航、首页、业务模块空状态、设置。
- `src/components/ui/`：shadcn 组件源代码，可以按项目需要维护。
- `src/hooks/`：界面状态逻辑。
- `src/lib/workspace.ts`：类型明确的 Tauri IPC 边界，浏览器预览不伪造数据库状态。
- `src-tauri/src/storage.rs`：应用目录和 SQLite schema 初始化。
- `src-tauri/src/lib.rs`：异步桌面命令，磁盘操作在阻塞任务池执行。
- `docs/bootstrap.md`：本次框架范围与验收方式。

## 本地数据

Tauri 按 `com.tradequill.desktop` 标识确定应用数据目录，设置页显示实际路径：

- macOS：`~/Library/Application Support/com.tradequill.desktop/`。
- Windows：`%APPDATA%/com.tradequill.desktop/`。

目录内包含 `tradequill.sqlite3` 和 `attachments/`。首个 schema 仅有应用元数据，不提前固化客户/业务模型。迁移通过事务和 `PRAGMA user_version` 控制；高于当前支持版本的数据会被拒绝，不做降级覆盖。再次启动不会清空数据。当前数据库没有应用层加密。

主题偏好存于本机 WebView localStorage，业务数据只经 Rust 访问 SQLite。暂时手动备份时先完全退出应用，再复制整个应用数据目录；以后实现的 CSV/Excel 导出不会替代包含附件的完整备份。

## 安全与扩展边界

生产 CSP 只允许本地资源和 Tauri IPC，未授予前端任意文件访问或 SQL 执行权限。后续增加业务模块时，用明确的 Rust 命令暴露能力，不向界面暴露任意 SQL 或任意路径读写。

本项目没有绑定远端仓库。发布签名、Windows 实机验收和正式分发需后续配置。

## 参与贡献

开发流程、检查要求和问题反馈方式见 [贡献指南](CONTRIBUTING.md)。
