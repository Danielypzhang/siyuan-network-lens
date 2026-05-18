# Tasks

- [x] Task 1: 修复多行 block 列表层级渲染
  - [x] 1.1: 重写 `normalizeSectionDraftBody` 中多行 block 的渲染逻辑，跟踪当前缩进层级
  - [x] 1.2: 识别 `- ` 开头的行作为列表项，根据上下文推断层级深度
  - [x] 1.3: 识别 `**粗体标签**：` 格式的行作为同级列表项（与父 block 同级）
  - [x] 1.4: 非列表标记的连续行作为上一个列表项的续行/子内容

- [x] Task 2: 修改 planThemePagePrompt 提示词
  - [x] 2.1: 修改 `i18n/ui.ts` 中 `planThemePagePrompt` 的中英文文本，移除"动态选择章节组合"引导
  - [x] 2.2: 新文本引导 AI 按模板类型指定的章节组合生成完整页面结构

- [x] Task 3: 构建验证

# Task Dependencies
- Task 1 和 Task 2 相互独立，可并行执行
- Task 3 depends on Task 1 + Task 2
