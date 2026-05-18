# generateThemeSection 提示词清理与 AI 调用合并 Spec

## Why
1. `generateThemeSection` 的 system prompt 中包含与 user prompt 重复的 JSON schema 指令（"Generate exactly one wiki section draft." 及后续行），且硬编码了 intro/sources 章节的特殊指令，无法适配动态章节内容。
2. 当前每个章节单独调用一次 AI（tech_topic 5 个章节 = 5 次调用），但每次调用都发送完整的 payload（源文档证据块），造成大量重复的输入 token 消耗。2 个文档的场景下 5 次调用不合理，应合并为 1 次调用。

## 增量更新影响分析
- **当前架构**：每个 `generateThemeSection` 调用都接收 `existingWikiContent`（完整当前 wiki 页面），AI 看到已有内容后生成单个章节的更新版本
- **合并后**：一次 `generateAllSections` 调用同样接收 `existingWikiContent`，AI 看到已有内容后生成所有章节的更新版本
- **结论**：合并对增量更新无负面影响。`incrementalModePrompt` 和 `existingWikiContent` 的传递方式不变，AI 仍然能看到已有内容并据此更新。合并后反而更好，因为 AI 在一次调用中能同时看到所有章节的上下文，避免独立生成时章节间可能出现的矛盾

## What Changes
- 移除 `generateThemeSection` system prompt 中从 "Generate exactly one wiki section draft." 开始的所有硬编码 JSON schema 指令（行 393-398），这些内容已在 user prompt 的 `generateThemeSectionSchemaPrompt` 中覆盖
- 将 `generateThemeSection`（单章节生成）改为 `generateAllSections`（全章节一次生成），将所有章节合并到一次 AI 调用中
- 修改 i18n 文本，适配全章节生成的 JSON schema（返回 sections 数组而非单个 section）
- 修改 `wiki-ai.ts` 中的方法签名和实现
- 修改 `use-analytics-wiki-actions.ts` 中的调用方式，从 `Promise.all(sectionOrder.map(...))` 改为单次调用
- 修改 `wiki-ai.test.ts` 中的测试用例

## Impact
- Affected code: `wiki-ai.ts`, `use-analytics-wiki-actions.ts`, `i18n/ui.ts`, `wiki-ai.test.ts`
- AI 调用次数：从 N 次（章节数）减少到 1 次
- 输入 token 消耗：大幅减少（payload 只发送 1 次而非 N 次）
- 输出 token 消耗：基本不变（总内容量相同，只是结构从 N 个独立响应变为 1 个数组响应）
- 增量更新：无负面影响，反而更好（跨章节上下文一致性）

## ADDED Requirements

### Requirement: 移除 system prompt 中冗余的 JSON schema 指令
`generateAllSections` 的 system prompt SHALL 不再包含硬编码的 JSON schema 指令，这些指令已在 user prompt 中覆盖。

#### Scenario: system prompt 不包含重复的 schema 指令
- **WHEN** 构建 `generateAllSections` 的 system prompt
- **THEN** system prompt 仅包含 `buildWikiSystemPrompt` 的输出，不包含 "Generate exactly one wiki section draft." 及后续的 JSON schema 指令

### Requirement: 全章节一次生成
系统 SHALL 在一次 AI 调用中生成所有章节内容，而非每个章节单独调用。

#### Scenario: tech_topic 模板 2 个文档
- **WHEN** 用户对 2 个文档执行 Wiki 维护，模板类型为 tech_topic（5 个章节）
- **THEN** AI 调用次数为 1 次（而非 5 次）
- **AND** 返回的 JSON 包含所有 5 个章节的 drafts 数组

#### Scenario: 返回格式
- **WHEN** AI 生成全章节内容
- **THEN** 返回的 JSON 格式为 `{ sections: [{ sectionType, title, format, blocks, sourceRefs }, ...] }`
- **AND** 每个章节的 blocks 和 sourceRefs 结构与当前单章节生成时一致

#### Scenario: 增量更新模式
- **WHEN** 在增量更新模式下调用 `generateAllSections`
- **THEN** `existingWikiContent` 和 `incrementalModePrompt` 仍然传递给 AI
- **AND** AI 能看到已有内容并据此更新所有章节

## MODIFIED Requirements

### Requirement: generateThemeSectionSchemaPrompt → generateAllSectionsSchemaPrompt
修改前（单章节）：
> 请只返回 JSON，并包含 sectionType、title、format、blocks、sourceRefs。每个 block 必须包含 text 和 sourceRefs。请使用所提供的源文档 documentId（非 blockId）填充每个 block 的 sourceRefs。

修改后（全章节）：
> 请只返回 JSON，并包含 sections 数组。每个 section 必须包含 sectionType、title、format、blocks、sourceRefs。每个 block 必须包含 text 和 sourceRefs。请使用所提供的源文档 documentId（非 blockId）填充每个 block 的 sourceRefs。按 pagePlan.sectionOrder 的顺序生成所有章节。

### Requirement: generateThemeSectionPrompt → generateAllSectionsPrompt
修改前：
> 请只生成一个 wiki 章节草稿。主题：{theme}。章节类型：{sectionType}。

修改后：
> 请为主题生成完整的 wiki 页面，包含所有章节。主题：{theme}。

### Requirement: AiWikiService 接口
修改前：`generateThemeSection(params)` 返回单个 `WikiSectionDraft`
修改后：`generateAllSections(params)` 返回 `WikiSectionDraft[]`

### Requirement: buildWikiUserPayload
修改前：传递 `sectionType` 字段
修改后：不再传递 `sectionType` 字段（pagePlan 中已包含 sectionOrder）

## REMOVED Requirements

### Requirement: system prompt 中的硬编码章节特殊指令
**Reason**: 这些指令（sources 章节的 sourceRefs 要求、intro 章节的摘要要求）已在 user prompt 的 schema prompt 和 pagePlan 的 sectionGoals/sectionFormats 中覆盖，无需在 system prompt 中硬编码。
**Migration**: 无需迁移，pagePlan 已在 user prompt 的 payload 中传递，AI 可从中获取章节特定指导。
