# 分流标签

| 技能角色        | GitHub 标签     | 使用条件                                   |
| --------------- | --------------- | ------------------------------------------ |
| needs-triage    | needs-triage    | 尚未完成范围和优先级判断                   |
| needs-info      | needs-info      | 缺少实施必要信息、账号准入、许可或业务决策 |
| ready-for-agent | ready-for-agent | 规格明确，路线所需条件和阻塞依赖均已满足   |
| ready-for-human | ready-for-human | 下一步需要人完成账号申请、合同确认等操作   |
| wontfix         | wontfix         | 明确决定不实施                             |

复用同名标签，仅创建缺失项。`enhancement`、`documentation` 等描述任务类别，可与一个当前分流状态并用。原生 blocked-by 表示任务依赖；仅等待上游 Issue 时不必额外标记 `needs-info`。

数据源选择、生产资格、保存权限或真实样本未验证时，不将依赖这些条件的功能标为 `ready-for-agent`。一个平台或路线验证通过，不自动解除其他路线的条件。状态转换须在 Issue 中记录证据；完成文档交付不会自动关闭其中描述的功能需求。
