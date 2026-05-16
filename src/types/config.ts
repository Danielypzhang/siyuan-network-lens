import { ensureAiProviderConfigState } from '@/components/ai-provider-presets'
import { SUMMARY_CARD_DEFINITIONS, buildSummaryCardVisibilityDefaults } from '@/analytics/summary-card-config'
import type { AiContextCapacity } from '@/analytics/ai-inbox'
import {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
} from '@/types/ai-defaults'
import type { AiProviderConfigMap, AiProviderPresetKey } from '@/types/ai-provider'

export {
  DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  DEFAULT_AI_MAX_TOKENS,
  DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  DEFAULT_AI_TEMPERATURE,
} from '@/types/ai-defaults'
export const DEFAULT_WIKI_PAGE_SUFFIX = '-llm-wiki'
export const DEFAULT_WIKI_INDEX_TITLE = 'LLM-Wiki-Index'
export const DEFAULT_WIKI_LOG_TITLE = 'LLM-Wiki-Maintenance-Log'
export const DEFAULT_WIKI_CONTAINER_PATH = '/知识库/LLM Wiki'

export const WIKI_GENERATION_MODES = ['compressed', 'full'] as const
export type WikiGenerationMode = typeof WIKI_GENERATION_MODES[number]

export const WIKI_SOURCE_CITATION_MODES = ['inline', 'section', 'both'] as const
export type WikiSourceCitationMode = typeof WIKI_SOURCE_CITATION_MODES[number]

export const CURRENT_WIKI_PROMPT_VERSION = 1

export const DEFAULT_WIKI_MAINTENANCE_PROMPT = [
  '你是一位专业的思源笔记知识库维护专家，擅长从原始文档中提取、组织和关联知识，生成结构化的 Wiki 页面。',
  '',
  '## 核心原则',
  '1. **证据锚定**：每个关键结论必须绑定至少一个源文档作为证据，并在句末使用思源块引用语法 `((文档ID "序号"))` 标注。',
  '2. **可靠性分级**：对每条陈述标注可信度标签。',
  '   - `[✓]` 来源明确支持',
  '   - `[~]` 基于来源的合理推断',
  '   - `[?]` 当前证据矛盾或不足，待验证',
  '   - `[+]` AI 基于常识补充的背景信息（不作为绝对事实）',
  '3. **个人相关性**：优先提取对用户个人有具体启发、行动指导或反思价值的内容，避免通用大道理。',
  '4. **宁缺毋滥**：证据不足时，使用 `[待补充]` 标记空缺，**禁止编造内容**。',
  '',
  '## 内容要求',
  '1. **一句话摘要**：开篇用一段话概括本主题的核心要点。',
  '2. **关键概念**：列出并解释文中出现的关键人物、公司、技术术语、缩写等。',
  '3. **关键文档**：列出本主题下最有价值的文档（支持多个），说明每篇的独特贡献或视角。',
  '4. **核心原则与框架**：提炼可复用的方法论、原则、模型或思维框架。',
  '5. **关系证据**：分析文档之间的引用关系、互补关系或矛盾点，并标注具体来源。',
  '6. **待解问题**：列出当前资料尚未回答、需要进一步探索的问题。',
  '7. **下一步行动**：基于当前知识状态，建议用户可以立即采取的具体行动（可落地、可执行）。',
  '',
  '## 输出格式',
  '- 每条事实性陈述尽量绑定来源引用：`<sup>((文档ID "序号"))</sup>`，其中"文档ID"为源文档块ID，"序号"为连续编号。',
  '- 可信度标签直接放在陈述句首或句末，如 `[✓] Transformer 架构由 Vaswani 等人提出。<sup>((20240101 "1"))</sup>`',
].join('\n')

export interface PluginConfig {
  showSummaryCards: boolean
  showDocuments?: boolean
  showLargeDocuments?: boolean
  showRead?: boolean
  showTodaySuggestions?: boolean
  showReferences?: boolean
  showRanking?: boolean
  showCommunities?: boolean
  showTrends?: boolean
  showOrphans?: boolean
  showDormant?: boolean
  showBridges?: boolean
  showPropagation?: boolean
  showLlmWiki?: boolean
  showOrphanBridge?: boolean
  themeNotebookId?: string
  themeDocumentPath: string
  themeNamePrefix: string
  themeNameSuffix: string
  analysisExcludedPaths?: string
  analysisExcludedNamePrefixes?: string
  analysisExcludedNameSuffixes?: string
  readTagNames?: string[]
  readTitlePrefixes?: string
  readTitleSuffixes?: string
  readPaths?: string
  aiEnabled?: boolean
  aiProviderPreset?: AiProviderPresetKey
  aiProviderConfigs?: AiProviderConfigMap
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string

  aiRequestTimeoutSeconds?: number
  aiMaxTokens?: number
  aiTemperature?: number
  aiMaxContextMessages?: number
  aiContextCapacity?: AiContextCapacity
  enableConsoleLogging?: boolean
  showDocumentIndex?: boolean
  wikiEnabled?: boolean
  wikiPageSuffix?: string
  wikiIndexTitle?: string
  wikiLogTitle?: string
  wikiContainerPath?: string
  wikiIncrementalEnabled?: boolean
  wikiGenerationMode?: WikiGenerationMode
  wikiMaintenancePrompt?: string
  wikiMaintenancePromptVersion?: number
  wikiHallucinationMarkingEnabled?: boolean
  wikiSourceCitationMode?: WikiSourceCitationMode
  wikiBatchSize?: number
  wikiMaxSourceDocs?: number
  summaryCardOrder?: string[]
}

export const DEFAULT_CONFIG: PluginConfig = {
  showSummaryCards: true,
  ...buildSummaryCardVisibilityDefaults(),
  showLlmWiki: true,
  themeNotebookId: '',
  themeDocumentPath: '',
  themeNamePrefix: '',
  themeNameSuffix: '',
  analysisExcludedPaths: '',
  analysisExcludedNamePrefixes: '',
  analysisExcludedNameSuffixes: '',
  readTagNames: [],
  readTitlePrefixes: '',
  readTitleSuffixes: '',
  readPaths: '',
  aiEnabled: false,
  aiProviderPreset: 'custom',
  aiProviderConfigs: undefined,
  aiBaseUrl: '',
  aiApiKey: '',
  aiModel: '',

  aiRequestTimeoutSeconds: DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  aiMaxTokens: DEFAULT_AI_MAX_TOKENS,
  aiTemperature: DEFAULT_AI_TEMPERATURE,
  aiMaxContextMessages: DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  aiContextCapacity: 'balanced',
  enableConsoleLogging: false,
  showDocumentIndex: false,
  wikiEnabled: false,
  wikiPageSuffix: DEFAULT_WIKI_PAGE_SUFFIX,
  wikiIndexTitle: DEFAULT_WIKI_INDEX_TITLE,
  wikiLogTitle: DEFAULT_WIKI_LOG_TITLE,
  wikiContainerPath: DEFAULT_WIKI_CONTAINER_PATH,
  wikiIncrementalEnabled: true,
  wikiGenerationMode: 'full',
  wikiMaintenancePrompt: DEFAULT_WIKI_MAINTENANCE_PROMPT,
  wikiMaintenancePromptVersion: CURRENT_WIKI_PROMPT_VERSION,
  wikiHallucinationMarkingEnabled: true,
  wikiSourceCitationMode: 'inline',
  wikiBatchSize: 0,
  wikiMaxSourceDocs: 10,
  summaryCardOrder: undefined,
}

export function ensureConfigDefaults(config: PluginConfig) {
  for (const definition of SUMMARY_CARD_DEFINITIONS) {
    const visibilityKey = definition.visibilityConfigKey
    if (typeof config[visibilityKey] === 'boolean') {
      continue
    }

    const legacyVisibilityKey = definition.legacyVisibilityConfigKey
    if (legacyVisibilityKey && typeof config[legacyVisibilityKey] === 'boolean') {
      config[visibilityKey] = config[legacyVisibilityKey]
      continue
    }

    config[visibilityKey] = definition.defaultVisible
  }
  if (typeof config.themeNotebookId !== 'string') {
    config.themeNotebookId = ''
  }
  if (typeof config.themeDocumentPath !== 'string') {
    config.themeDocumentPath = ''
  }
  if (typeof config.themeNamePrefix !== 'string') {
    config.themeNamePrefix = ''
  }
  if (typeof config.themeNameSuffix !== 'string') {
    config.themeNameSuffix = ''
  }
  if (typeof config.analysisExcludedPaths !== 'string') {
    config.analysisExcludedPaths = ''
  }
  if (typeof config.analysisExcludedNamePrefixes !== 'string') {
    config.analysisExcludedNamePrefixes = ''
  }
  if (typeof config.analysisExcludedNameSuffixes !== 'string') {
    config.analysisExcludedNameSuffixes = ''
  }
  if (config.themeNotebookId.trim() && config.themeDocumentPath.trim() && !looksLikeNotebookScopedPath(config.themeDocumentPath)) {
    config.themeDocumentPath = `/${config.themeNotebookId.trim()}${normalizeLegacyPath(config.themeDocumentPath)}`
  }
  if (!Array.isArray(config.readTagNames)) {
    config.readTagNames = []
  }
  if (typeof config.readTitlePrefixes !== 'string') {
    config.readTitlePrefixes = ''
  }
  if (typeof config.readTitleSuffixes !== 'string') {
    config.readTitleSuffixes = ''
  }
  if (typeof config.readPaths !== 'string') {
    config.readPaths = ''
  }
  if (typeof config.aiEnabled !== 'boolean') {
    config.aiEnabled = false
  }
  if (
    config.aiProviderPreset !== 'siliconflow'
    && config.aiProviderPreset !== 'openai'
    && config.aiProviderPreset !== 'gemini'
    && config.aiProviderPreset !== 'custom'
  ) {
    config.aiProviderPreset = undefined
  }
  if (!config.aiProviderConfigs || typeof config.aiProviderConfigs !== 'object') {
    config.aiProviderConfigs = {}
  }
  if (typeof config.aiBaseUrl !== 'string') {
    config.aiBaseUrl = ''
  }
  if (typeof config.aiApiKey !== 'string') {
    config.aiApiKey = ''
  }
  if (typeof config.aiModel !== 'string') {
    config.aiModel = ''
  }
  config.aiRequestTimeoutSeconds = normalizePositiveInteger(
    config.aiRequestTimeoutSeconds,
    DEFAULT_AI_REQUEST_TIMEOUT_SECONDS,
  )
  config.aiMaxTokens = normalizePositiveInteger(
    config.aiMaxTokens,
    DEFAULT_AI_MAX_TOKENS,
  )
  config.aiTemperature = normalizeTemperature(
    config.aiTemperature,
    DEFAULT_AI_TEMPERATURE,
  )
  config.aiMaxContextMessages = normalizePositiveInteger(
    config.aiMaxContextMessages,
    DEFAULT_AI_MAX_CONTEXT_MESSAGES,
  )
  if (config.aiContextCapacity !== 'compact' && config.aiContextCapacity !== 'balanced' && config.aiContextCapacity !== 'full') {
    config.aiContextCapacity = 'balanced'
  }
  if (typeof config.enableConsoleLogging !== 'boolean') {
    config.enableConsoleLogging = false
  }
  if (typeof config.showDocumentIndex !== 'boolean') {
    config.showDocumentIndex = false
  }
  if (typeof config.wikiEnabled !== 'boolean') {
    config.wikiEnabled = false
  }
  config.wikiPageSuffix = normalizeNonEmptyString(
    config.wikiPageSuffix,
    DEFAULT_WIKI_PAGE_SUFFIX,
  )
  config.wikiIndexTitle = normalizeNonEmptyString(
    config.wikiIndexTitle,
    DEFAULT_WIKI_INDEX_TITLE,
  )
  config.wikiLogTitle = normalizeNonEmptyString(
    config.wikiLogTitle,
    DEFAULT_WIKI_LOG_TITLE,
  )
  // 旧版本使用 wikiContainerName（纯目录名），迁移到 wikiContainerPath（完整路径）
  if ('wikiContainerName' in config) {
    delete (config as Record<string, unknown>).wikiContainerName
  }
  config.wikiContainerPath = normalizeNonEmptyString(
    config.wikiContainerPath,
    DEFAULT_WIKI_CONTAINER_PATH,
  )
  if (typeof config.wikiIncrementalEnabled !== 'boolean') {
    config.wikiIncrementalEnabled = true
  }
  if (typeof config.wikiGenerationMode !== 'string' || !WIKI_GENERATION_MODES.includes(config.wikiGenerationMode as WikiGenerationMode)) {
    config.wikiGenerationMode = 'full'
  }
  if (typeof config.wikiMaintenancePrompt !== 'string' || !config.wikiMaintenancePrompt.trim()) {
    config.wikiMaintenancePrompt = DEFAULT_WIKI_MAINTENANCE_PROMPT
    config.wikiMaintenancePromptVersion = CURRENT_WIKI_PROMPT_VERSION
  }
  if (typeof config.wikiMaintenancePromptVersion !== 'number') {
    config.wikiMaintenancePromptVersion = 0
  }
  if (typeof config.wikiHallucinationMarkingEnabled !== 'boolean') {
    config.wikiHallucinationMarkingEnabled = true
  }
  if (typeof config.wikiSourceCitationMode !== 'string' || !WIKI_SOURCE_CITATION_MODES.includes(config.wikiSourceCitationMode as WikiSourceCitationMode)) {
    config.wikiSourceCitationMode = 'inline'
  }
  if (typeof config.wikiBatchSize !== 'number' || config.wikiBatchSize < 0) {
    config.wikiBatchSize = 0
  }
  if (typeof config.wikiMaxSourceDocs !== 'number' || config.wikiMaxSourceDocs < 0) {
    config.wikiMaxSourceDocs = 10
  }
  ensureAiProviderConfigState(config)
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const normalized = typeof value === 'string' && value.trim()
    ? Number.parseInt(value, 10)
    : typeof value === 'number'
      ? Math.floor(value)
      : Number.NaN

  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : fallback
}

function normalizeTemperature(value: unknown, fallback: number): number {
  const normalized = typeof value === 'string' && value.trim()
    ? Number.parseFloat(value)
    : typeof value === 'number'
      ? value
      : Number.NaN

  return Number.isFinite(normalized) && normalized >= 0 && normalized <= 2
    ? normalized
    : fallback
}

function normalizeNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback
}

function normalizeLegacyPath(value: string): string {
  const normalized = value
    .replace(/\\/g, '/')
    .trim()
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash === '/'
    ? withLeadingSlash
    : withLeadingSlash.replace(/\/+$/, '')
}

function looksLikeNotebookScopedPath(value: string): boolean {
  return value.includes('|') || value.trim().split('/').filter(Boolean).length >= 2
}
