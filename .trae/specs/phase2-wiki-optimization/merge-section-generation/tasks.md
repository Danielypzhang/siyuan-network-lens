# Tasks

- [x] Task 1: 移除 system prompt 中冗余的 JSON schema 指令 + 改为 generateAllSections
  - [x] 1.1: 修改 `wiki-ai.ts` 中 `generateThemeSection` → `generateAllSections`，移除 system prompt 中行 393-398 的硬编码指令，system prompt 仅保留 `buildWikiSystemPrompt` 的输出
  - [x] 1.2: 修改 user prompt，使用新的 `generateAllSectionsPrompt`（无 sectionType 参数）和 `generateAllSectionsSchemaPrompt`
  - [x] 1.3: 修改 `buildWikiUserPayload`，移除 `sectionType` 参数和字段
  - [x] 1.4: 新增 `normalizeAllSectionsDraft` 函数，解析 AI 返回的 `{ sections: [...] }` JSON，对每个 section 调用 `normalizeSectionDraft`
  - [x] 1.5: 修改返回类型为 `WikiSectionDraft[]`

- [x] Task 2: 修改 i18n 文本
  - [x] 2.1: 新增 `generateAllSectionsPrompt`（中英文），替换 `generateThemeSectionPrompt`
  - [x] 2.2: 新增 `generateAllSectionsSchemaPrompt`（中英文），替换 `generateThemeSectionSchemaPrompt`，适配 sections 数组格式

- [x] Task 3: 修改调用方
  - [x] 3.1: 修改 `use-analytics-wiki-actions.ts` 中两处 `Promise.all(sectionOrder.map(sectionType => generateThemeSection(...)))` 为单次 `generateAllSections(...)` 调用
  - [x] 3.2: 修改 `AiWikiService` 接口定义，`generateThemeSection` → `generateAllSections`

- [x] Task 4: 修改测试
  - [x] 4.1: 更新 `wiki-ai.test.ts` 中的测试用例，适配 `generateAllSections` 新接口

- [x] Task 5: 构建验证

# Task Dependencies
- Task 1 和 Task 2 可并行执行
- Task 3 依赖 Task 1 + Task 2
- Task 4 依赖 Task 1 + Task 2 + Task 3
- Task 5 依赖所有前置任务
