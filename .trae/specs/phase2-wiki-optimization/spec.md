# 阶段二：Wiki 模板提示词 + 动态章节结构 + 文档问答

## Why

阶段一完成了增量更新、分批循环、进度显示等基础设施，但 Wiki 生成质量仍有三个核心问题：
1. 所有主题共用同一个提示词，无法针对不同知识领域定制生成策略
2. Wiki 页面章节间内容重复（intro 与 highlights 重叠、sources 与文档列表冗余），根因是固定三共享章节结构迫使 AI 在内容不足以支撑时仍生成重叠内容
3. 缺少基于当前文档/聚焦内容的 AI 问答能力，用户无法针对正在阅读的内容即时提问

## What Changes

- 新增**模板类型提示词 + 主题覆盖**三层回退机制：全局提示词 → 模板类型提示词 → 主题提示词
- **动态章节结构**：取消固定的 intro/highlights/sources 三共享章节，改为 AI 根据模板类型和内容动态决定章节组合
- **新增文档问答功能**：基于当前活动文档或聚焦内容进行 AI 问答，支持将问答结果追加到对应 Wiki 页面

## Impact

- Affected code:
  - `src/types/config.ts` — 新增模板类型提示词配置、主题提示词存储
  - `src/analytics/wiki-template-model.ts` — 取消 WIKI_SHARED_SECTION_TYPES，所有章节平等可选
  - `src/analytics/wiki-template.ts` — resolveSectionOrder 适配动态章节
  - `src/analytics/wiki-ai.ts` — 三层提示词回退，章节边界约束内置到模板提示词
  - `src/analytics/wiki-store.ts` — 存储主题级提示词
  - `src/analytics/wiki-renderer.ts` — 适配动态章节渲染
  - `src/composables/use-analytics-wiki-actions.ts` — 传递主题提示词到 AI 调用
  - `src/composables/use-wiki-chat-session.ts` — 新增文档问答模式
  - `src/analytics/llm-wiki-chat-service.ts` — 新增文档问答提示词
  - `src/analytics/active-document.ts` — 扩展聚焦块 ID 获取
  - `src/components/WikiChatDialog.vue` — 新增文档问答 UI 入口
  - `src/components/RankingPanel.vue` — 主题级提示词配置入口
  - `src/components/SettingPanel.vue` — 模板类型提示词配置
  - `src/i18n/ui.ts` — 新增 i18n 文本

---

## ADDED Requirements

### Requirement: 模板类型提示词 + 主题覆盖（三层回退）

系统 SHALL 支持三层提示词回退机制：主题提示词 > 模板类型提示词 > 全局提示词。

每种模板类型（tech_topic/product_howto/social_topic/media_list）有内置的默认提示词，用户可在设置面板中覆盖。每个主题文档可配置独立的提示词覆盖，优先级最高。

#### Scenario: 主题有专属提示词
- **WHEN** 用户为主题"流水线配置"配置了专属提示词"请重点分析 SAP PP 模块的配置逻辑"
- **AND** 用户点击"维护LLM WIKI"
- **THEN** AI 生成时使用该主题的专属提示词，忽略模板类型提示词和全局提示词

#### Scenario: 主题无专属提示词，使用模板类型提示词
- **WHEN** 用户未为主题配置专属提示词
- **AND** AI 诊断该主题为 tech_topic 模板类型
- **THEN** AI 生成时使用 tech_topic 的模板类型提示词

#### Scenario: 无模板类型提示词，回退到全局
- **WHEN** 用户未覆盖模板类型提示词
- **AND** 内置默认模板提示词不适用
- **THEN** AI 生成时使用全局 `wikiMaintenancePrompt`

#### Scenario: 在设置面板配置模板类型提示词
- **WHEN** 用户在设置面板的"模板提示词"区域选择 tech_topic
- **THEN** 显示 tech_topic 的当前提示词（内置默认或用户覆盖）
- **AND** 用户可以编辑、保存，或重置为内置默认

#### Scenario: 在 RankingPanel 配置主题提示词
- **WHEN** 用户在 RankingPanel 的主题文档行上点击"编辑提示词"按钮
- **THEN** 弹出编辑对话框，显示当前主题的专属提示词（如有），下方显示当前生效的模板类型提示词作为参考
- **AND** 用户可以编辑并保存，或清除回退到模板类型提示词

### Requirement: 动态章节结构

系统 SHALL 取消固定的 intro/highlights/sources 三共享章节，改为 AI 根据模板类型和内容动态决定章节组合。

**一致性保障机制**：
1. 章节类型枚举固定（21 种），AI 不能发明新章节类型
2. 每种模板类型有推荐的默认章节组合，AI 在此基础上微调
3. planThemePage 阶段输出完整的 sectionOrder + sectionGoals，用户可在应用前审查
4. sources 章节始终作为最后一个章节（关系证据/参考来源放在末尾是通用惯例）

#### Scenario: 技术主题的章节组合
- **WHEN** AI 诊断主题为 tech_topic
- **THEN** 推荐章节组合为：intro → core_principles → method_path → use_cases → sources
- **AND** AI 可以根据内容增减可选章节（如增加 faq、减少 use_cases）

#### Scenario: 产品操作指南的章节组合
- **WHEN** AI 诊断主题为 product_howto
- **THEN** 推荐章节组合为：intro → basic_steps → advanced_usage → faq → sources
- **AND** AI 可以根据内容增减可选章节

#### Scenario: 内容不足以支撑多章节
- **WHEN** 主题只有 1-2 个源文档，内容较少
- **THEN** AI 可以只选择 intro + sources 两个章节
- **AND** 不会出现空洞的 highlights 章节

#### Scenario: sources 始终在末尾
- **WHEN** AI 规划页面章节顺序
- **THEN** sources 章节始终排在最后
- **AND** 即使 AI 尝试将 sources 放在其他位置，系统自动调整到末尾

#### Scenario: 向后兼容已有 Wiki 页面
- **WHEN** 已有 Wiki 页面包含旧的 intro/highlights/sources 章节标记
- **THEN** 渲染器仍能正确识别和渲染这些标记
- **AND** 下次更新时 AI 重新规划章节结构，旧标记被替换

### Requirement: 文档问答功能

系统 SHALL 支持基于当前活动文档或聚焦内容进行 AI 问答，用户可以在阅读文档时即时提问。

#### Scenario: 基于当前文档问答
- **WHEN** 用户在思源笔记中打开文档 A
- **AND** 用户点击"AI 问答"按钮
- **THEN** 系统获取文档 A 的内容作为上下文
- **AND** 用户的问题基于文档 A 的内容回答

#### Scenario: 基于聚焦内容问答
- **WHEN** 用户在思源笔记中使用聚焦模式（zoomIn）聚焦到块 B
- **AND** 用户点击"AI 问答"按钮
- **THEN** 系统获取块 B 及其子块的内容作为上下文
- **AND** 用户的问题基于聚焦内容回答

#### Scenario: 问答结果追加到 Wiki
- **WHEN** 用户完成一次文档问答
- **AND** 用户点击"追加到 Wiki"按钮
- **THEN** 问答内容被追加到对应主题 Wiki 页面的人工备注区

---

## MODIFIED Requirements

### Requirement: 提示词构建逻辑

原逻辑：`buildWikiSystemPrompt` 将全局 `wikiMaintenancePrompt` 无条件追加到所有 AI 调用。

修改为：`buildWikiSystemPrompt` 接受 `themePrompt` 和 `templateType` 参数，按三层回退选择提示词：
1. `themePrompt` 存在且非空 → 使用主题提示词
2. 模板类型有用户覆盖提示词 → 使用模板类型提示词
3. 否则 → 使用全局 `wikiMaintenancePrompt`

同时，模板类型提示词内置章节边界约束，替代在 generateThemeSection 中硬编码约束的方式。

### Requirement: WIKI_SHARED_SECTION_TYPES

原定义：`['intro', 'highlights', 'sources'] as const` — 三个固定共享章节。

修改为：取消 `WIKI_SHARED_SECTION_TYPES` 常量。所有章节类型（包括 intro、highlights、sources）均为可选，由 AI 在 planThemePage 阶段动态决定。唯一约束是 sources 始终排在最后。

### Requirement: resolveSectionOrder

原逻辑：固定返回 `['intro', 'highlights', ...middleModules, 'sources']`。

修改为：以 AI 在 planThemePage 中输出的 `sectionOrder` 为准，仅确保 sources 在末尾。当 AI 未返回有效 sectionOrder 时，使用模板类型的推荐默认章节组合作为 fallback。

### Requirement: generateThemeSection 提示词

原逻辑：`generateThemeSection` 的 system prompt 对 intro 有简单约束，对 highlights 和 sources 无约束。

修改为：章节边界约束内置到模板类型提示词中，通过 `buildWikiSystemPrompt` 传递。`generateThemeSection` 的 system prompt 不再硬编码章节约束，改为依赖上层传入的提示词中已包含的约束。

### Requirement: WikiChatScope

原定义：`{ mode: 'topic' | 'document', targetPage?: WikiIndexPage }`

修改为：`{ mode: 'topic' | 'document' | 'active', targetPage?: WikiIndexPage, activeContent?: { documentId: string, title: string, content: string, isZoomedIn: boolean } }`

新增 `active` 模式：基于当前活动文档/聚焦内容进行问答，不依赖 Wiki 页面索引。

### Requirement: DEFAULT_WIKI_MAINTENANCE_PROMPT

原内容包含"关键文档"、"关系证据"等与章节系统冲突的指令。

修改为：精简为通用原则层（证据锚定、可靠性分级、个人相关性、宁缺毋滥），移除与章节职责重叠的具体内容要求（"一句话摘要"、"关键文档"、"关系证据"等）。这些具体内容要求由模板类型提示词承载。
