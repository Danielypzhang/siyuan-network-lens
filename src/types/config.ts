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
  '你是思源笔记的 Wiki 维护助手。基于提供的源文档证据块生成主题 Wiki 页面。',
  '',
  '## 核心原则',
  '1. 每个关键结论必须绑定至少一个源文档作为证据来源',
  '2. 区分事实、推断和待验证内容，用 [✓] [~] [?] [+] 标记',
  '3. 优先提取对用户个人有启发价值的具体内容，避免通用总结',
  '4. 证据不足时标注 [待补充] 而非编造内容',
  '',
  '## 内容要求',
  '- 主题概览：用 3-5 句话概括该主题下的知识现状，指出核心发现和主要空白',
  '- 关键文档：列出最有价值的文档，说明每篇的独特贡献',
  '- 核心原则：从文档中提炼可复用的方法论、原则或框架',
  '- 关系证据：说明文档之间的引用关系、互补关系或矛盾关系',
  '- 待解问题：列出当前资料尚未回答的问题',
  '- 下一步行动：基于当前知识状态建议的具体行动',
  '',
  '## 输出格式',
  '- 每个段落绑定来源引用：<sup>((文档ID "序号"))</sup>',
  '- 可靠性标记：[✓]来源支持 [~]合理推断 [?]待验证 [+] AI补充',
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
