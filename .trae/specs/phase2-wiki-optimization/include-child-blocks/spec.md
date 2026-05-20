# 文档子块内容发送给 AI Spec

## Why
当前 `collectDocumentSourceBlocks` 只获取文档根块的 kramdown 内容，不包含子块。这导致发送给 AI 的 sourceBlockTexts 只有文档标题和少量根块内容，缺少文档的实际正文（子块），AI 生成的 Wiki 质量受限。

## What Changes
- 修改 `collectDocumentSourceBlocks` 函数，递归获取文档的所有子块 kramdown 内容
- 新增 `getChildBlocks` API 调用支持，获取文档的子块 ID 列表
- 对每个子块调用 `getBlockKramdown` 获取其 kramdown 内容
- 将所有子块内容按 primary/secondary 分类后合并返回
- 更新 `collectDocumentSourceBlocks` 的参数签名，新增 `getChildBlocks` 回调

## Impact
- Affected specs: phase2-wiki-optimization
- Affected code:
  - `src/analytics/document-index-source-blocks.ts` — 核心修改，递归获取子块
  - `src/analytics/ai-document-summary.ts` — 传递 `getChildBlocks` 回调
  - `src/composables/use-analytics-document-index.ts` — 传递 `getChildBlocks` 回调
  - `src/composables/use-analytics.ts` — 传递 `getChildBlocks` 回调
  - `src/analytics/document-index-source-blocks.test.ts` — 更新测试

## ADDED Requirements

### Requirement: 文档子块内容收集
系统 SHALL 在索引文档时，递归获取文档的所有子块 kramdown 内容，而不仅仅是文档根块。

#### Scenario: 文档包含子块
- **WHEN** 文档有子块（如标题下的段落、列表等）
- **THEN** 系统获取文档根块和所有子块的 kramdown 内容
- **AND** 按字符数阈值分类为 primary（≥80字符）或 secondary（≥30字符）

#### Scenario: 文档无子块
- **WHEN** 文档没有子块（空文档或只有根块）
- **THEN** 系统行为与当前一致，只返回根块内容

#### Scenario: 子块获取失败
- **WHEN** 获取某个子块的 kramdown 失败
- **THEN** 系统跳过该子块，继续处理其他子块，不中断整个流程

### Requirement: 子块递归深度限制
系统 SHALL 限制子块递归深度为 3 层，避免无限递归和 token 预算溢出。

#### Scenario: 深层嵌套文档
- **WHEN** 文档有超过 3 层嵌套的子块
- **THEN** 系统只获取前 3 层子块的内容
