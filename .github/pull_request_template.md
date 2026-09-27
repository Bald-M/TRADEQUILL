## 关联 Issue

Closes #

## 变更说明

说明要解决的问题、最终行为、实现范围及明确不包含的内容。

## 验证

- [ ] `pnpm format:check`
- [ ] `pnpm build`
- [ ] `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [ ] `pnpm check:rust`
- [ ] `pnpm tauri build --no-bundle`，或已说明不适用原因
- [ ] 已完成受影响的 Windows/macOS 真实桌面流程，或已明确列出未验证平台

请列出具体测试环境、命令、结果及未覆盖项。纯文档或仓库配置修改可将不适用项标为 N/A，并说明原因。

## 数据、兼容性与迁移

说明 SQLite schema、已有数据、Rust IPC、操作系统/架构和升级/降级兼容性；不适用时写明。

## 界面、日志与隐私

界面变化请附浅色/深色及相关加载、空、失败状态的截图，并记录 900 × 600 最小窗口、键盘操作和失败重试验证。日志、截图和样本必须移除客户资料、业务附件、账户、密钥、令牌和用户名路径。

## 风险与回滚

说明主要风险、恢复方式及回滚步骤。

## 提交检查

- [ ] PR 标题符合 Conventional Commits
- [ ] 新行为已有相称的自动化测试或可重复验证证据
- [ ] README / DESIGN / CONTRIBUTING / docs 已按需更新
- [ ] `CHANGELOG.md` 的 `Unreleased` 已更新，或本次不适用
- [ ] 业务数据仅通过明确的 Rust IPC 访问，未开放任意 SQL 或路径访问
- [ ] 保持个人单机、本地优先、无 AI、无云同步和无遥测边界
