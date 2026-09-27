# 为 TradeQuill 做贡献

欢迎通过问题反馈、文档、翻译、测试和代码改进 TradeQuill。本文参考 [EasyDeployMesh 贡献指南](https://github.com/Bald-M/EasyDeployMesh/blob/main/CONTRIBUTING.md) 的组织方式，具体要求以本项目为准。

## 开始之前

先阅读 [README](README.md)（[English](README.en.md)）了解运行方式与当前范围；界面修改遵循 [设计规范](DESIGN.md)，使用 Agent 开发时遵循 [AGENTS.md](AGENTS.md)。

TradeQuill 当前是本地优先的个人外贸桌面基础框架。客户、业务、导入导出和完整备份仍在规划中。较大的业务功能或架构调整，请先与维护者明确场景、范围和验收条件，再开始实现；第一版维持单机、无在线 AI、无云同步和无遥测的边界。

项目托管于 [Bald-M/TRADEQUILL](https://github.com/Bald-M/TRADEQUILL)。开始前先搜索已有 Issue 和 PR，避免重复工作；不要向参考项目提交 TradeQuill 的问题或改动。

## 开发环境

从仓库根目录操作。环境要求与 [README 开发环境](README.md#开发环境) 保持一致：Node.js 22.12+（推荐 22 LTS）、pnpm 11.19.0、Rust stable，以及对应平台的 Tauri 原生依赖。

```sh
pnpm install --frozen-lockfile
pnpm desktop:dev
```

`pnpm dev` 仅预览前端；浏览器中会提示无法连接桌面数据库。涉及 IPC、SQLite、文件路径和窗口行为的改动需要在桌面应用中验证。

`pnpm build` 执行前端类型检查与生产构建；`pnpm desktop:build` 生成当前平台的桌面包。`pnpm desktop:build:all` 通过 GitHub Actions 构建 Windows/macOS 安装包，等待完成后下载到 `release/<run-id>/`。

## 修改流程

1. 检查工作区和分支，保留已有改动；先查看相关 Issue/PR，避免重复工作。
2. 从更新后的远端 `main` 创建任务分支，Agent 默认使用 `codex/<任务说明>`。
3. 每次改动聚焦一个问题，沿用现有 React、TypeScript 和 Rust 结构。根据行为变化补充有意义的测试或可重复的手动验证步骤。
4. 用户可见行为变化同步更新文档；README 信息变化时同步中英文版本，重要变更记录到 [CHANGELOG](CHANGELOG.md) 的 `Unreleased`。
5. 完成相关检查和审查后提交，提交信息明确描述变化，例如 `fix: preserve workspace data on restart` 或 `docs: clarify desktop setup`。

修改依赖时同步对应锁文件。Tauri 各配套包的兼容性要求见 README，避免只升级单个包或通过删除锁文件绕过失败。

## 检查与验证

现有 CI 配置见 [Desktop checks](.github/workflows/check.yml)。涉及应用代码的完整检查命令为：

```sh
pnpm format:check
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
pnpm check:rust
pnpm tauri build --no-bundle
```

开发过程中可用 `pnpm typecheck` 快速检查前端类型。需要修复格式时，对改动文件运行 Prettier，Rust 使用 `cargo fmt --manifest-path src-tauri/Cargo.toml`，并复查生成的差异。

纯文档修改只需检查相关文件格式、链接和事实一致性。当前尚无业务自动化测试套件，不使用不存在的 `pnpm test` 或 `pnpm check` 命令作为验收依据；新增测试后应记录实际入口。

根据改动补充专项验证：

- 界面：浅色/深色主题、900 × 600 最小窗口、键盘焦点、加载/空/失败状态及重试。
- 数据：初始化、重复启动保留数据、迁移事务，以及高版本 schema 拒绝降级。
- 打包：在目标平台检查包生成、安装与启动，分别记录操作系统和架构。`--no-bundle` 编译成功不代表安装包已验证。

在提交说明中列出执行命令、结果及未覆盖的平台。历史结果见 [验收记录](docs/validation.md)，不能代替本次验证；远端结果必须对应当前提交 SHA。

## 数据与安全边界

使用临时工作区和脱敏样本验证数据变更，避免用真实客户数据库执行迁移或恢复实验。SQLite 和附件需要一起考虑；表格导出不能替代完整备份。

业务数据经明确的 Rust IPC 命令访问，保持 CSP 和文件访问范围约束。错误处理需要保留数据和可恢复上下文，不能通过清空数据库或绕过版本检查消除报错。

提交、截图和日志中移除客户信息、业务附件、密钥及不必要的本机路径。若发现疑似漏洞，通过维护者已确认的私密渠道沟通；当前未配置专用安全报告入口，不在公开问题中附带敏感数据或可利用细节。

## 问题反馈

请尽量提供能够复现问题的信息：

- 应用版本或提交 SHA、操作系统及 CPU 架构。
- 发生在浏览器预览、桌面开发模式还是打包后的应用。
- 最小复现步骤、预期行为和实际行为。
- 已脱敏的错误日志或截图，以及是否可重复出现。
- 涉及数据问题时说明 schema 版本和操作过程，用最小样本代替真实数据库。

功能建议请说明要解决的工作场景、现有方式的困难和完成标准，并先搜索已有讨论再提交新的 Issue。

## Pull Request

PR 应说明问题与最终行为，并附相关需求来源、检查结果、兼容性或迁移影响。界面改动附截图，数据和打包改动附手动验证步骤及实际平台；未完成项明确标注。

提交前核对差异只包含本任务文件。适用 CI 与审查通过后，由有权限的维护者按仓库规则合并；Agent 的自动交付授权按 AGENTS.md 执行，不代替平台要求的批准。

## 许可证

提交贡献即表示你同意按项目的 [Apache License 2.0](LICENSE) 许可该贡献，并确认你有权按这些条款提交内容。
