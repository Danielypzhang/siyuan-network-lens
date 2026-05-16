# Tasks

- [x] Task 1: 模板类型提示词定义与存储
  - [x] 1.1: 在 `config.ts` 中定义 4 种模板类型的内置默认提示词（含章节边界约束）
  - [x] 1.2: 在 `PluginConfig` 中新增 `wikiTemplatePrompts?: Record<WikiTemplateType, string>` 字段
  - [x] 1.3: 在 `ensureConfigDefaults` 中处理模板类型提示词的默认值
  - [x] 1.4: 精简 `DEFAULT_WIKI_MAINTENANCE_PROMPT`，移除与章节职责重叠的具体内容要求

- [x] Task 2: 主题级提示词存储与读取
  - [x] 2.1: 在 `WikiPageSnapshotRecord` 中新增 `themePrompt?: string` 字段
  - [x] 2.2: 在 `normalizePageRecord` 中处理 `themePrompt` 的规范化
  - [x] 2.3: 在 `savePageRecord` / `getPageRecord` 中正确读写 `themePrompt`

- [x] Task 3: 三层提示词回退逻辑
  - [x] 3.1: `buildWikiSystemPrompt` 新增 `themePrompt` 和 `templateType` 参数，实现三层回退
  - [x] 3.2: `diagnoseThemeTemplate`、`planThemePage`、`generateThemeSection` 传递提示词参数
  - [x] 3.3: `prepareWikiPreview` 从 `storedRecord` 读取 `themePrompt`，从诊断结果获取 `templateType`，传递到 AI 调用链

- [x] Task 4: 动态章节结构
  - [x] 4.1: 取消 `WIKI_SHARED_SECTION_TYPES` 常量，所有章节类型平等可选
  - [x] 4.2: 为每种模板类型定义推荐的默认章节组合（fallback）
  - [x] 4.3: 修改 `resolveSectionOrder`：以 AI 的 `sectionOrder` 为准，仅确保 sources 在末尾；fallback 使用模板类型推荐组合
  - [x] 4.4: 修改 `planThemePage` 的 user prompt，引导 AI 动态选择章节组合而非固定三共享章节
  - [x] 4.5: 修改 `normalizeSectionGoalMap`，为 fallback 场景设置模板类型对应的默认 sectionGoals
  - [x] 4.6: 确保渲染器向后兼容旧的 intro/highlights/sources 章节标记

- [x] Task 5: 提示词配置 UI
  - [x] 5.1: 在 SettingPanel 中新增"模板提示词"配置区域（4 个模板类型 tab + textarea + 重置按钮）
  - [x] 5.2: 在 RankingPanel 主题文档行上添加"编辑提示词"按钮
  - [x] 5.3: 创建提示词编辑对话框组件（显示主题提示词 + 当前生效的模板类型提示词参考）
  - [x] 5.4: 添加 i18n 文本

- [x] Task 6: 文档问答 — 活动文档/聚焦内容获取
  - [x] 6.1: 扩展 `active-document.ts`，新增 `resolveProtyleZoomBlockId` 从 protyle 中提取聚焦块 ID
  - [x] 6.2: 在 `use-analytics.ts` 中新增 `activeZoomBlockId` 响应式变量
  - [x] 6.3: 新增获取活动文档/聚焦内容的方法（调用 `getBlockKramdown`）

- [x] Task 7: 文档问答 — 聊天会话扩展
  - [x] 7.1: `WikiChatScope` 新增 `active` 模式和 `activeContent` 字段
  - [x] 7.2: `llm-wiki-chat-service.ts` 新增文档问答系统提示词 `buildActiveDocChatSystemPrompt`
  - [x] 7.3: `use-wiki-chat-session.ts` 的 `sendMessage` 支持 `active` 模式：直接使用 `activeContent` 作为上下文
  - [x] 7.4: 新增"追加到 Wiki"功能：将问答结果追加到对应主题 Wiki 页面的人工备注区

- [x] Task 8: 文档问答 UI 入口
  - [x] 8.1: 在 RankingPanel 或 App.vue 中添加"AI 问答"按钮
  - [x] 8.2: 点击时获取当前活动文档/聚焦内容，构造 `WikiChatScope.active` 并打开聊天对话框
  - [x] 8.3: WikiChatDialog 适配 `active` 模式显示（标题显示文档名而非 Wiki 页面名）
  - [x] 8.4: 添加 i18n 文本

# Task Dependencies

- Task 2 depends on Task 1（主题提示词需要与模板提示词配合）
- Task 3 depends on Task 1 + Task 2（三层回退需要两层提示词就绪）
- Task 4 is independent of Task 1-3（动态章节结构可独立实施）
- Task 5 depends on Task 1 + Task 2 + Task 3（UI 需要存储和回退逻辑就绪）
- Task 7 depends on Task 6（聊天会话需要活动文档内容）
- Task 8 depends on Task 7（UI 需要聊天会话支持 active 模式）
- Task 1, 4, 6 can be done in parallel
