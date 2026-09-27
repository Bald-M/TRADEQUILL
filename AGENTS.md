# TradeQuill Agent 约定

## 自动开发与交付

代码项目的代码、配置或项目文档修改任务开始前，读取并遵循 `/Users/zhangzihan/.codex/skills/automatic-dev-delivery/SKILL.md`，先建立任务分支，再完成实现、验证、本地审查、PR、CI、获授权合并及本地同步清理。该技能记录用户的默认交付授权；当次用户限制优先。纯问答、只读审查、技能安装和临时产物生成不触发发布。

开始时检查工作区、分支和远端；没有远端时完成本地验证与提交，明确报告远端交付不可用，不自行创建远端。保留用户已有修改和其他任务提交。

## 项目上下文

- 开始实现前阅读 `README.md`；涉及产品范围时阅读 `docs/bootstrap.md`；需要已有验证证据时阅读 `docs/validation.md`，区分历史结果与本次验证。
- TradeQuill 是面向 Windows/macOS 的本地优先个人外贸桌面应用。业务数据经 Rust IPC 访问本地 SQLite；浏览器预览不能替代桌面验收。
- 第一版维持单机、无 AI、无遥测的边界。业务占位页只有实现并验证后才能描述为可用功能。

## 修改与验证

- 依赖版本、脚本和构建配置以 `package.json`、`pnpm-lock.yaml`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 和 `src-tauri/tauri.conf.json` 为准；按锁文件安装依赖。
- 修改前端时运行相关类型检查、格式检查与构建；修改 Rust 时运行格式检查、Clippy 及相关测试。具体命令查阅 `package.json` 和 `.github/workflows/check.yml`。纯文档修改检查格式、引用和事实一致性。
- 修改界面时检查浅色/深色主题、最小窗口尺寸、键盘操作，以及相关加载、空状态和失败状态。
- 修改数据库时验证迁移事务、重复启动保留数据及高版本 schema 拒绝降级；保持前端只能调用明确的业务 IPC，避免暴露任意 SQL 或路径访问能力。
- 修改桌面打包时区分前端构建、原生编译和安装包生成；分别记录平台与架构。未执行的平台构建、安装和签名不能标记为已验证。

## 技能与需求记录

- 用户调用 ask-matt 时读取 `/Users/zhangzihan/.codex/skills/ask-matt/SKILL.md`，按任务选择其中的流程；修改本文件时读取 `/Users/zhangzihan/.codex/skills/writing-for-agents/SKILL.md`。
- 需求来源优先使用当次用户指令及明确关联的规格。需要引入 issue tracker、`CONTEXT.md` 或 ADR 布局时，按 `setup-matt-pocock-skills` 完成配置；配置前不假定这些文件或服务存在。
- 交付说明包含变更、实际验证结果和未完成项；远端交付适用时附 PR 与合并结果。
