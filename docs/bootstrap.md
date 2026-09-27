# TradeQuill 框架搭建

## 需求来源

用户确认产品名 TradeQuill，在 ~/Code 下创建 Windows/macOS 桌面应用框架，使用 Tailwind CSS 和 shadcn。此前确认：个人单机、接受 WebView、SQLite 本地存储、第一版不做 AI。

## 本次交付范围

- Tauri 2 + React + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui。
- 可启动的桌面窗口、侧栏导航、客户/业务/数据占位页、设置和明暗主题。
- Rust 异步 IPC 初始化 SQLite，显示真实路径和 schema 版本；出错时可重试。
- 业务数据不上传、无遥测、无在线字体、无 AI 调用。
- 依赖锁文件、格式检查、类型检查、Rust 检查、双平台 CI 配置和运行说明。
- 暂不实现客户 CRUD、业务流转、导入导出及自动备份；不把占位页作为已完成业务功能。

## 验收

- 安装锁定依赖，前端类型检查、格式检查、生产构建通过。
- cargo fmt/check/clippy 通过；macOS 桌面开发构建和打包可运行。
- 检查导航、浅/深主题、最小桌面尺寸、键盘焦点、无数据库时的提示和重试。
- 实际桌面窗口显示数据库位置；重启后保留现有数据，schema 不被重复创建。
- 浏览器预览明确提示需要桌面环境，不能显示假的连接成功。
- Windows 的实际编译与运行结果只能由 Windows 环境确认。
