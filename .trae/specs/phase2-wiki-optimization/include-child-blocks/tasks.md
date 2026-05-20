# Tasks

- [ ] Task 1: 修改 `collectDocumentSourceBlocks` 支持递归获取子块
  - [ ] SubTask 1.1: 更新函数签名，新增 `getChildBlocks` 回调参数
  - [ ] SubTask 1.2: 实现递归获取子块逻辑（深度限制 3 层）
  - [ ] SubTask 1.3: 对每个子块调用 `getBlockKramdown` 获取内容
  - [ ] SubTask 1.4: 合并所有子块内容，按 primary/secondary 分类返回
- [ ] Task 2: 更新调用方传递 `getChildBlocks` 回调
  - [ ] SubTask 2.1: `ai-document-summary.ts` — 传递 `getChildBlocks`
  - [ ] SubTask 2.2: `use-analytics-document-index.ts` — 传递 `getChildBlocks`
  - [ ] SubTask 2.3: `use-analytics.ts` — 传递 `getChildBlocks` 到所有调用点
- [ ] Task 3: 更新测试
  - [ ] SubTask 3.1: 更新 `document-index-source-blocks.test.ts` 测试用例
  - [ ] SubTask 3.2: 运行全部 wiki 相关测试验证

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
