# Wiki 列表渲染与提示词修复 Spec

## Why
1. Wiki 渲染器对多行 block.text 的列表层级处理不正确，AI 返回的子列表项（如"配置路径"下的模式一/模式二）被渲染为同级扁平列表，丢失了层级结构。
2. `planThemePagePrompt` 仍引导 AI "动态选择最合适的章节组合"，但现在模板类型已由用户手动指定，不需要 AI 自行精简章节。

## What Changes
- 修改 `wiki-renderer.ts` 中 `normalizeSectionDraftBody` 的多行 block 渲染逻辑，正确识别 AI 返回的子列表结构
- 修改 `i18n/ui.ts` 中 `planThemePagePrompt`，移除"动态选择章节组合"的引导，改为"按模板类型指定的章节生成完整页面结构"

## Impact
- Affected code: `wiki-renderer.ts`, `i18n/ui.ts`

## ADDED Requirements

### Requirement: 多行 block 列表层级渲染
渲染器 SHALL 正确处理 AI 返回的多行 block.text，保持子列表的层级结构。

#### Scenario: 配置路径下有子列表
- **WHEN** AI 返回 block.text 包含：
  ```
  **配置路径**：
  - 模式一：简化模式
  - 将整条产线映射为一个SAP工作中心。
  - 模式二：精细模式
  - 将产线按真实工站结构拆分为多个工序。
  **关键约束或限制**：简化模式一旦固化...
  ```
- **THEN** 渲染结果 SHALL 为：
  ```markdown
  - **配置路径**：
    - 模式一：简化模式
      - 将整条产线映射为一个SAP工作中心。
    - 模式二：精细模式
      - 将产线按真实工站结构拆分为多个工序。
  - **关键约束或限制**：简化模式一旦固化...
  ```

### Requirement: 模板类型指定后固定章节组合
当用户手动指定了模板类型时，planThemePage 的提示词 SHALL 引导 AI 按模板类型的 enabledModules 生成完整的页面结构，不再允许 AI 自行精简章节。

#### Scenario: 用户指定 tech_topic 模板
- **WHEN** 用户选择 tech_topic 模板（enabledModules: intro, core_principles, method_path, use_cases, sources）
- **THEN** planThemePagePrompt SHALL 不再包含"动态选择章节组合"的引导
- **AND** 已有的 enabledModulesHint 强制指令继续生效

## MODIFIED Requirements

### Requirement: planThemePagePrompt 提示词
修改前：
> 请根据内容量和主题性质动态选择最合适的章节组合——可以选择精简组合（如 3–4 个章节）或丰富组合（如 5–7 个章节），不要固定包含所有共享章节，只选择最适合该主题的章节。

修改后：
> 请按照模板类型指定的章节组合生成完整的页面结构，确保所有指定章节都被包含。"sources" 章节必须始终作为 sectionOrder 的最后一个章节。
