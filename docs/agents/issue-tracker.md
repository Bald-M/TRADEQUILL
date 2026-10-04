# Issue tracker: GitHub

需求、规格和任务记录在 [Bald-M/TRADEQUILL](https://github.com/Bald-M/TRADEQUILL/issues)，通过 `gh` 操作。PR 不作为需求入口；读取当前用户明确关联的 PR 不受此约定影响。

## 读取与发布

- 操作时显式使用 `--repo Bald-M/TRADEQUILL`；开始前搜索所有状态的 Issue，读取相关正文和评论，避免重复发布。
- 使用 `gh issue view` / `gh issue list` 读取；多行正文写入临时文件，通过 `gh issue create` / `gh issue edit --body-file` 发布，保留真实换行。
- 先发布总需求，再按依赖顺序发布子单；每条包含目标行为、可验证验收、范围、来源、依赖和未满足条件。只修改当次任务授权的 Issue。
- 创建后读回正文、标签与关系。发布结果未知时先搜索确认，不直接重试创建。

## 父子与依赖

优先使用 GitHub 原生 sub-issue 和 blocked-by 关系。正文同时保留关联编号，便于脱离 GitHub UI 阅读。API 的关系参数使用 Issue 的数据库 `id`，不是显示的 `number` 或 GraphQL `node_id`。

- 父子关系：`POST /repos/Bald-M/TRADEQUILL/issues/{parent}/sub_issues`，JSON 为 `{"sub_issue_id": <child database id>}`。
- 阻塞关系：`POST /repos/Bald-M/TRADEQUILL/issues/{child}/dependencies/blocked_by`，JSON 为 `{"issue_id": <blocker database id>}`。
- 通过对应 GET 端点读回关系；平台不支持时，保留父单任务清单及子单的 `Parent` / `Blocked by`，并报告降级。

依赖表示实施前置，不表示总需求归属。前置单部分完成或关闭不自动证明下游已就绪：先核对该路线的验收和决策记录，再调整状态。已批准的拆分本身不代表功能实现授权，也不因创建子单关闭总需求。

标签含义见 [分流标签](triage-labels.md)。
