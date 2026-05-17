import { isAiConfigComplete, limitChatCompletionMessages, resolveAiEndpoint, resolveAiRequestOptions } from './ai-inbox'
import { truncateSourceBlocksToTokenBudget } from './document-index-source-blocks'
import type { WikiThemeBundle } from './wiki-generation'
import {
  WIKI_OPTIONAL_SECTION_TYPES,
  WIKI_SECTION_TYPES,
  WIKI_TEMPLATE_DEFAULT_SECTIONS,
  WIKI_TEMPLATE_TYPES,
  type WikiPagePlan,
  type WikiSectionDraft,
  type WikiSectionFormat,
  type WikiSectionType,
  type WikiTemplateConfidence,
  type WikiTemplateDiagnosis,
  type WikiTemplateType,
} from './wiki-template-model'

const SHARED_SECTION_TYPES = ['intro', 'highlights', 'sources'] as const
import { resolveSectionOrder } from './wiki-template-selection'
import { resolveUiLocale, t } from '@/i18n/ui'
import { DEFAULT_WIKI_TEMPLATE_PROMPTS, type PluginConfig } from '@/types/config'

type ForwardProxyFn = (
  url: string,
  method?: string,
  payload?: any,
  headers?: any[],
  timeout?: number,
  contentType?: string,
) => Promise<IResForwardProxy>

type AiConfig = Pick<
  PluginConfig,
  | 'aiEnabled'
  | 'aiBaseUrl'
  | 'aiApiKey'
  | 'aiModel'
  | 'aiRequestTimeoutSeconds'
  | 'aiMaxTokens'
  | 'aiTemperature'
  | 'aiMaxContextMessages'
  | 'wikiGenerationMode'
  | 'wikiMaintenancePrompt'
  | 'wikiHallucinationMarkingEnabled'
  | 'wikiSourceCitationMode'
  | 'wikiBatchSize'
  | 'wikiTemplatePrompts'
>

type ChatCompletionMessage = { role: 'system' | 'user' | 'assistant', content: string }

export interface AiWikiService {
  diagnoseThemeTemplate: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    existingWikiContent?: string
    isIncremental?: boolean
    themePrompt?: string
  }) => Promise<WikiTemplateDiagnosis>
  planThemePage: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
    existingWikiContent?: string
    isIncremental?: boolean
    themePrompt?: string
    templateType?: string
  }) => Promise<WikiPagePlan>
  generateThemeSection: (params: {
    config: AiConfig
    payload: WikiThemeBundle
    diagnosis: WikiTemplateDiagnosis
    pagePlan: WikiPagePlan
    sectionType: WikiSectionType
    existingWikiContent?: string
    isIncremental?: boolean
    themePrompt?: string
    templateType?: string
  }) => Promise<WikiSectionDraft>
}

const BASE_SYSTEM_PROMPT = [
  'You are a topic wiki maintenance assistant for SiYuan notes.',
  'Base every answer on the provided topic page bundle, source document bundles, template signals, and analysis signals.',
  'Return JSON only.',
  'Do not output Markdown, explanations, or code blocks.',
  'Do not invent documents, topic pages, relationships, evidence, or user-visible claims that are not grounded in the input.',
  'All user-visible text must follow the current workspace UI language.',
].join(' ')

const FULL_MODE_PROMPT = [
  'You have access to source document evidence blocks (sourceBlockTexts) — read them carefully.',
  'Extract specific facts, data, examples, and arguments from the evidence blocks.',
  'Cite the specific source document for each claim using sourceRefs with documentId.',
  'Produce substantive content — 3 to 5 detailed points per section when evidence is sufficient.',
  'Be specific and concrete. Avoid generic summaries.',
].join(' ')

const HALLUCINATION_MARKING_PROMPT = [
  'Prefix every claim with a reliability tag on its own line:',
  '[✓] — directly supported by source evidence blocks',
  '[~] — reasonably inferred from multiple sources',
  '[?] — speculative, needs human verification',
  '[+] — AI supplementary suggestion, not from source documents',
  'Use exactly one tag per claim. Place the tag at the start of the block text.',
].join('\n')

const SOURCE_CITATION_PROMPT = [
  'Every block must include sourceRefs with the documentId values that support it.',
  'When sourceRefs are empty, explicitly note the gap in the block text.',
  'For the sources (catalog) section, each block must reference all relevant source documentIds.',
].join(' ')

function buildWikiSystemPrompt(config: AiConfig, themePrompt?: string, templateType?: string): string {
  const parts = [BASE_SYSTEM_PROMPT]

  if (config.wikiGenerationMode === 'full') {
    parts.push(FULL_MODE_PROMPT)
  }

  if (config.wikiHallucinationMarkingEnabled !== false) {
    parts.push(HALLUCINATION_MARKING_PROMPT)
  }

  if (config.wikiSourceCitationMode === 'inline' || config.wikiSourceCitationMode === 'both') {
    parts.push(SOURCE_CITATION_PROMPT)
  }

  const globalPrompt = config.wikiMaintenancePrompt?.trim()
  if (globalPrompt) {
    parts.push(globalPrompt)
  }

  const resolvedThemePrompt = resolveThemePrompt(config, themePrompt, templateType)
  if (resolvedThemePrompt) {
    parts.push(resolvedThemePrompt)
  }

  return parts.join('\n\n')
}

function resolveThemePrompt(config: AiConfig, themePrompt?: string, templateType?: string): string | undefined {
  if (themePrompt?.trim()) {
    return themePrompt.trim()
  }
  if (templateType) {
    const userOverride = config.wikiTemplatePrompts?.[templateType]?.trim()
    if (userOverride) {
      return userOverride
    }
    const builtIn = DEFAULT_WIKI_TEMPLATE_PROMPTS[templateType]?.trim()
    if (builtIn) {
      return builtIn
    }
  }
  return undefined
}

function buildWikiUserPayload(params: {
  payload: WikiThemeBundle
  diagnosis?: WikiTemplateDiagnosis
  pagePlan?: WikiPagePlan
  sectionType?: WikiSectionType
  existingWikiContent?: string
  maxInputTokens?: number
  systemPromptChars?: number
  isIncremental?: boolean
}): string {
  const { payload, diagnosis, pagePlan, sectionType, existingWikiContent, maxInputTokens, systemPromptChars, isIncremental } = params

  const CHARS_PER_TOKEN = 2.5
  const systemPromptTokens = (systemPromptChars ?? 0) / CHARS_PER_TOKEN
  const existingWikiTokens = existingWikiContent
    ? (existingWikiContent.length + 50) / CHARS_PER_TOKEN
    : 0
  const userPromptOverheadTokens = 300
  const reservedTokens = systemPromptTokens + existingWikiTokens + userPromptOverheadTokens

  const availableTokens = maxInputTokens
    ? Math.max(0, maxInputTokens - reservedTokens)
    : Infinity
  const availableChars = availableTokens * CHARS_PER_TOKEN

  const hasExistingWiki = Boolean(existingWikiContent)

  const prioritizedDocs = payload.sourceDocuments.map(doc => {
    const deltaStatus = (doc as any).deltaStatus as string | undefined
    const isUnchanged = isIncremental && hasExistingWiki && deltaStatus === 'unchanged'
    const isDeleted = deltaStatus === 'deleted'

    if (isDeleted) {
      return { doc, priority: 3, deltaStatus, isUnchanged: false, isDeleted: true }
    }
    if (isUnchanged) {
      return { doc, priority: 2, deltaStatus, isUnchanged: true, isDeleted: false }
    }
    return { doc, priority: 1, deltaStatus: deltaStatus || 'new', isUnchanged: false, isDeleted: false }
  })

  prioritizedDocs.sort((a, b) => a.priority - b.priority)

  let sourceDocChars = 0
  const sourceDocumentMap = new Map<string, any>()

  for (const { doc, priority, deltaStatus, isUnchanged, isDeleted } of prioritizedDocs) {
    if (isDeleted) {
      sourceDocumentMap.set(doc.documentId, {
        documentId: doc.documentId,
        title: doc.title,
        deltaStatus: 'deleted',
      })
      continue
    }

    if (isUnchanged) {
      sourceDocumentMap.set(doc.documentId, {
        documentId: doc.documentId,
        title: doc.title,
        deltaStatus: 'unchanged',
      })
      continue
    }

    const base: any = {
      documentId: doc.documentId,
      title: doc.title,
      positioning: doc.positioning,
      propositions: doc.propositions,
      keywords: doc.keywords,
      deltaStatus: deltaStatus || 'new',
    }
    if (doc.sourceBlockTexts && doc.sourceBlockTexts.length > 0) {
      const totalTextLen = doc.sourceBlockTexts.reduce((sum, t) => sum + t.length, 0)
      if (sourceDocChars + totalTextLen <= availableChars) {
        base.sourceBlockTexts = doc.sourceBlockTexts
        sourceDocChars += totalTextLen
      } else {
        const remaining = availableChars - sourceDocChars
        if (remaining > 100) {
          let used = 0
          const truncated: string[] = []
          for (const text of doc.sourceBlockTexts) {
            if (used + text.length > remaining) {
              truncated.push(text.slice(0, remaining - used))
              break
            }
            truncated.push(text)
            used += text.length
          }
          base.sourceBlockTexts = truncated
          sourceDocChars += used
        }
      }
    }
    sourceDocumentMap.set(doc.documentId, base)
  }

  const sourceDocuments = payload.sourceDocuments.map(doc => sourceDocumentMap.get(doc.documentId))

  const bundleForAi: any = {
    themeName: payload.themeName,
    pageTitle: payload.pageTitle,
    themeDocumentId: payload.themeDocumentId,
    themeDocumentTitle: payload.themeDocumentTitle,
    sourceDocuments,
    templateSignals: payload.templateSignals,
    analysisSignals: payload.analysisSignals,
  }

  const result: any = { payload: bundleForAi }

  if (diagnosis) {
    result.diagnosis = diagnosis
  }
  if (pagePlan) {
    result.pagePlan = pagePlan
  }
  if (sectionType) {
    result.sectionType = sectionType
  }

  let content = JSON.stringify(result)

  if (existingWikiContent) {
    content = [
      t('analytics.wiki.incrementalModePrompt'),
      `Existing wiki page content:\n${existingWikiContent}`,
      '',
      content,
    ].join('\n')
  }

  return content
}

export function createAiWikiService(deps: {
  forwardProxy: ForwardProxyFn
}): AiWikiService {
  return {
    async diagnoseThemeTemplate(params) {
      assertAiReady(params.config)

      const requestOptions = resolveAiRequestOptions(params.config)
      const systemPrompt = [
        buildWikiSystemPrompt(params.config, params.themePrompt),
        'Diagnose the best wiki template for the current theme.',
        'The JSON must include templateType, confidence, reason, enabledModules, suppressedModules, and evidenceSummary.',
      ].join(' ')

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              t('analytics.wiki.diagnoseThemeTemplatePrompt', { theme: params.payload.themeName }),
              t('analytics.wiki.diagnoseThemeTemplateSchemaPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              '',
              buildWikiUserPayload({
                payload: params.payload,
                existingWikiContent: params.existingWikiContent,
                maxInputTokens: requestOptions.maxTokens,
                systemPromptChars: systemPrompt.length,
                isIncremental: params.isIncremental,
              }),
            ].join('\n'),
          },
        ],
      })

      return normalizeTemplateDiagnosis(parseJsonFromContent(response))
    },

    async planThemePage(params) {
      assertAiReady(params.config)

      const requestOptions = resolveAiRequestOptions(params.config)
      const systemPrompt = [
        buildWikiSystemPrompt(params.config, params.themePrompt, params.templateType),
        'Generate a wiki page plan for the diagnosed theme template.',
        'The JSON must include templateType, confidence, coreSections, optionalSections, sectionOrder, sectionGoals, and sectionFormats.',
      ].join(' ')

      const enabledModulesHint = params.diagnosis.enabledModules.length > 0
        ? `\nMandatory sections for this template: ${params.diagnosis.enabledModules.join(', ')}. The sectionOrder MUST include ALL of these sections. Do NOT omit any of them.`
        : ''

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              t('analytics.wiki.planThemePagePrompt', { theme: params.payload.themeName }),
              enabledModulesHint,
              t('analytics.wiki.planThemePageSchemaPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              '',
              buildWikiUserPayload({
                payload: params.payload,
                diagnosis: params.diagnosis,
                existingWikiContent: params.existingWikiContent,
                maxInputTokens: requestOptions.maxTokens,
                systemPromptChars: systemPrompt.length,
                isIncremental: params.isIncremental,
              }),
            ].join('\n'),
          },
        ],
      })

      return normalizePagePlan(parseJsonFromContent(response), params.diagnosis)
    },

    async generateThemeSection(params) {
      assertAiReady(params.config)

      const requestOptions = resolveAiRequestOptions(params.config)
      const systemPrompt = (() => {
        const parts = [
          buildWikiSystemPrompt(params.config, params.themePrompt, params.templateType),
          'Generate exactly one wiki section draft.',
          'The JSON must include sectionType, title, format, blocks, and sourceRefs.',
          'Each block must include text and sourceRefs.',
          'For every block, populate sourceRefs with the documentId values from the provided source documents that best support that block content. Use documentId, never blockId.',
          'For the sources (catalog) section, each block sourceRefs must include all relevant source documentIds so the renderer can produce explicit reference entries.',
          'For the intro (overview) section, each block text must be a concise self-contained summary sentence. Do not include block IDs, document IDs, or technical identifiers in the visible text.',
        ]
        if (params.sectionType === 'conflict') {
          parts.push(t('analytics.wiki.conflictSectionPrompt'))
        }
        return parts.join(' ')
      })()

      const response = await requestChatCompletion({
        config: params.config,
        forwardProxy: deps.forwardProxy,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              t('analytics.wiki.generateThemeSectionPrompt', { theme: params.payload.themeName, sectionType: params.sectionType }),
              t('analytics.wiki.generateThemeSectionSchemaPrompt'),
              t('analytics.wiki.conservativeFallbackPrompt'),
              '',
              buildWikiUserPayload({
                payload: params.payload,
                diagnosis: params.diagnosis,
                pagePlan: params.pagePlan,
                sectionType: params.sectionType,
                existingWikiContent: params.existingWikiContent,
                maxInputTokens: requestOptions.maxTokens,
                systemPromptChars: systemPrompt.length,
                isIncremental: params.isIncremental,
              }),
            ].join('\n'),
          },
        ],
      })

      return normalizeSectionDraft(parseJsonFromContent(response), params.sectionType)
    },
  }
}

function assertAiReady(config: AiConfig) {
  if (!config.aiEnabled) {
    throw new Error(t('analytics.wiki.enableTodaySuggestionsInSettings'))
  }
  if (!isAiConfigComplete(config)) {
    throw new Error(t('analytics.wiki.incompleteAiSettings'))
  }
}

async function requestChatCompletion(params: {
  config: AiConfig
  forwardProxy: ForwardProxyFn
  messages: ChatCompletionMessage[]
}) {
  const requestOptions = resolveAiRequestOptions(params.config)
  const endpoint = resolveAiEndpoint(params.config.aiBaseUrl!, 'chat/completions')
  const messages = limitChatCompletionMessages(params.messages, requestOptions.maxContextMessages)
  const body = JSON.stringify({
    model: params.config.aiModel,
    messages,
    max_tokens: requestOptions.maxTokens,
    temperature: requestOptions.temperature,
  })

  const response = await params.forwardProxy(
    endpoint,
    'POST',
    body,
    [
      { Authorization: `Bearer ${params.config.aiApiKey}` },
      { Accept: 'application/json' },
    ],
    requestOptions.timeoutMs,
    'application/json',
  )

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(t('analytics.wiki.aiRequestFailed', { status: response?.status ?? 'unknown status' }))
  }

  try {
    return JSON.parse(response.body)
  } catch (parseError) {
    console.error('[NetworkLens][Wiki] Failed to parse AI response as JSON:', {
      status: response?.status,
      bodyLength: response?.body?.length ?? 0,
      bodyPreview: response?.body?.slice?.(0, 200) ?? '',
      error: parseError instanceof Error ? parseError.message : String(parseError),
    })
    throw new Error(t('analytics.wiki.aiReturnedUnparseableJson'))
  }
}

function parseJsonFromContent(payload: any) {
  const content = extractChatCompletionContent(payload)
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/)
  const candidate = fencedMatch?.[1]?.trim() || content.trim()

  try {
    return JSON.parse(candidate)
  } catch (firstError) {
    const startIndex = candidate.indexOf('{')
    const endIndex = candidate.lastIndexOf('}')
    if (startIndex >= 0 && endIndex > startIndex) {
      try {
        return JSON.parse(candidate.slice(startIndex, endIndex + 1))
      } catch (secondError) {
        console.error('[NetworkLens][Wiki] Failed to parse AI content JSON after extraction:', {
          candidateLength: candidate.length,
          candidatePreview: candidate.slice(0, 300),
          extractedRange: `${startIndex}-${endIndex}`,
          firstError: firstError instanceof Error ? firstError.message : String(firstError),
          secondError: secondError instanceof Error ? secondError.message : String(secondError),
        })
      }
    } else {
      console.error('[NetworkLens][Wiki] AI returned content with no JSON object:', {
        candidateLength: candidate.length,
        candidatePreview: candidate.slice(0, 300),
        error: firstError instanceof Error ? firstError.message : String(firstError),
      })
    }
    throw new Error(t('analytics.wiki.aiReturnedInvalidJson'))
  }
}

function extractChatCompletionContent(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }
        if (typeof part?.text === 'string') {
          return part.text
        }
        return ''
      })
      .join('')
  }
  throw new Error(t('analytics.wiki.aiReturnedUnreadableContent'))
}

function normalizeTemplateDiagnosis(value: any): WikiTemplateDiagnosis {
  const isFallback = !isWikiTemplateType(value?.templateType)
    || !isWikiTemplateConfidence(value?.confidence)
    || !Array.isArray(value?.enabledModules)
    || typeof value?.reason !== 'string'
    || typeof value?.evidenceSummary !== 'string'
  const templateType = isWikiTemplateType(value?.templateType) ? value.templateType : 'tech_topic'
  const confidence = isWikiTemplateConfidence(value?.confidence) ? value.confidence : 'low'
  const enabledModules = normalizeSectionTypeList(
    value?.enabledModules,
    ['intro', 'highlights', 'sources'],
  )
  const suppressedModules = normalizeSectionTypeList(value?.suppressedModules, [])
    .filter(sectionType => !isWikiSharedSectionType(sectionType))

  return {
    templateType,
    confidence,
    reason: normalizeFallbackString(value?.reason, t('analytics.wiki.noClearTemplateReasonYet'), isFallback),
    enabledModules,
    suppressedModules,
    evidenceSummary: normalizeFallbackString(value?.evidenceSummary, t('analytics.wiki.noClearTemplateEvidenceYet'), isFallback),
  }
}

function normalizePagePlan(value: any, diagnosis: WikiTemplateDiagnosis): WikiPagePlan {
  const templateType = isWikiTemplateType(value?.templateType) ? value.templateType : diagnosis.templateType
  const confidence = isWikiTemplateConfidence(value?.confidence) ? value.confidence : diagnosis.confidence
  const templateDefaults = WIKI_TEMPLATE_DEFAULT_SECTIONS[templateType]
  const defaultCoreSections = templateDefaults.filter(
    (s): s is typeof SHARED_SECTION_TYPES[number] => SHARED_SECTION_TYPES.includes(s as typeof SHARED_SECTION_TYPES[number]),
  )
  const coreSections = uniqueSharedSectionTypes([
    ...defaultCoreSections,
    ...normalizeSharedSectionList(value?.coreSections, defaultCoreSections),
  ])
  const rawOptionalSections = normalizeOptionalSectionList(
    value?.optionalSections,
    diagnosis.enabledModules.filter((item): item is typeof WIKI_OPTIONAL_SECTION_TYPES[number] =>
      WIKI_OPTIONAL_SECTION_TYPES.includes(item as typeof WIKI_OPTIONAL_SECTION_TYPES[number]),
    ),
  )
  const allowedSections = buildAllowedPagePlanSections({
    templateType,
    enabledModules: diagnosis.enabledModules,
    suppressedModules: diagnosis.suppressedModules,
    optionalSections: rawOptionalSections,
  })
  const optionalSections = rawOptionalSections.filter(sectionType => allowedSections.includes(sectionType))
  const requestedOrder = normalizeSectionTypeList(value?.sectionOrder, [])
  const fallbackUsed = !Array.isArray(value?.coreSections)
    || !Array.isArray(value?.optionalSections)
    || !Array.isArray(value?.sectionOrder)
  const sectionOrder = normalizePlannedSectionOrder(requestedOrder, {
    templateType,
    confidence,
    allowedSections,
  })

  return {
    templateType,
    confidence,
    coreSections,
    optionalSections,
    sectionOrder,
    sectionGoals: normalizeSectionGoalMap(
      value?.sectionGoals,
      sectionOrder,
      fallbackUsed || sectionOrder.some(sectionType => !requestedOrder.includes(sectionType)),
      templateType,
    ),
    sectionFormats: normalizeSectionFormatMap(value?.sectionFormats, sectionOrder),
  }
}

function normalizeSectionDraft(value: any, requestedSectionType: WikiSectionType): WikiSectionDraft {
  const returnedSectionType = isWikiSectionType(value?.sectionType) ? value.sectionType : null
  const sectionType = requestedSectionType
  const format = isWikiSectionFormat(value?.format)
    ? value.format
    : inferSectionFormat(sectionType)
  const fallbackUsed = !Array.isArray(value?.blocks) || typeof value?.title !== 'string'
  const blocks = normalizeDraftBlocks(value?.blocks, sectionType, fallbackUsed)
  const sourceRefs = uniqueStrings([
    ...normalizeStringList(value?.sourceRefs),
    ...blocks.flatMap(block => block.sourceRefs),
  ])

  return {
    sectionType,
    title: normalizeFallbackString(value?.title, defaultSectionTitle(sectionType), fallbackUsed),
    format,
    blocks,
    sourceRefs,
  }
}

function normalizeDraftBlocks(value: unknown, sectionType: WikiSectionType, forceFallback = false): WikiSectionDraft['blocks'] {
  if (!forceFallback && Array.isArray(value)) {
    const blocks = value
      .filter((item): item is { text?: unknown, sourceRefs?: unknown } => Boolean(item) && typeof item === 'object')
      .map(item => ({
        text: normalizeString(item.text, ''),
        sourceRefs: normalizeStringList(item.sourceRefs),
      }))
      .filter(item => item.text.length > 0)

    if (blocks.length > 0 || sectionType === 'conflict') {
      return blocks
    }
  }

  return [{
    text: prefixFallback(defaultSectionFallback(sectionType)),
    sourceRefs: [],
  }]
}

function normalizeSectionGoalMap(
  value: unknown,
  allowedSections: WikiSectionType[],
  includeFallbackSignal: boolean,
  templateType: WikiTemplateType,
): WikiPagePlan['sectionGoals'] {
  const result: WikiPagePlan['sectionGoals'] = {}

  if (value && typeof value === 'object') {
    const allowed = new Set(allowedSections)

    for (const [key, item] of Object.entries(value)) {
      if (!allowed.has(key as WikiSectionType)) {
        continue
      }
      const normalized = normalizeString(item, '')
      if (normalized) {
        result[key as WikiSectionType] = normalized
      }
    }
  }

  if (includeFallbackSignal) {
    const templateDefaults = WIKI_TEMPLATE_DEFAULT_SECTIONS[templateType]
    const allowed = new Set(allowedSections)
    for (const sectionType of templateDefaults) {
      if (allowed.has(sectionType) && !result[sectionType]) {
        result[sectionType] = t('analytics.wiki.pagePlanFallbackGoal')
      }
    }
  }

  return result
}

function normalizeSectionFormatMap(value: unknown, allowedSections: WikiSectionType[]): WikiPagePlan['sectionFormats'] {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const allowed = new Set(allowedSections)
  const result: WikiPagePlan['sectionFormats'] = {}

  for (const [key, item] of Object.entries(value)) {
    if (!allowed.has(key as WikiSectionType) || !isWikiSectionFormat(item)) {
      continue
    }
    result[key as WikiSectionType] = item
  }

  return result
}

function normalizePlannedSectionOrder(
  requestedOrder: WikiSectionType[],
  params: {
    templateType: WikiTemplateType
    confidence: WikiTemplateConfidence
    allowedSections: WikiSectionType[]
  },
): WikiSectionType[] {
  const allowedSet = new Set(params.allowedSections)
  const filteredRequested = uniqueSectionTypes(requestedOrder.filter(sectionType => allowedSet.has(sectionType)))

  if (filteredRequested.length > 0) {
    const resolved = resolveSectionOrder({
      templateType: params.templateType,
      aiSectionOrder: filteredRequested,
    })
    const result = resolved.filter(sectionType => allowedSet.has(sectionType))
    const resultSet = new Set(result)
    if (allowedSet.has('intro') && !resultSet.has('intro')) {
      result.unshift('intro')
    }
    if (allowedSet.has('sources') && !resultSet.has('sources')) {
      result.push('sources')
    }
    return result
  }

  const fallbackOrder = resolveSectionOrder({
    templateType: params.templateType,
  }).filter(sectionType => allowedSet.has(sectionType))

  return uniqueSectionTypes(fallbackOrder)
}

function normalizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeFallbackString(value: unknown, fallback: string, fallbackUsed: boolean): string {
  const normalized = normalizeString(value, fallback)
  return fallbackUsed ? prefixFallback(normalized) : normalized
}

function prefixFallback(value: string): string {
  if (!value.trim() || /^(Fallback|回退)：/i.test(value)) {
    return value
  }
  return resolveUiLocale() === 'zh_CN' ? `回退：${value}` : `Fallback: ${value}`
}

function buildAllowedPagePlanSections(params: {
  templateType: WikiTemplateType
  enabledModules: WikiSectionType[]
  suppressedModules: WikiSectionType[]
  optionalSections: typeof WIKI_OPTIONAL_SECTION_TYPES[number][]
}): WikiSectionType[] {
  const suppressed = new Set<WikiSectionType>(params.suppressedModules.filter(sectionType => !isWikiSharedSectionType(sectionType)))
  const templateDefaults = WIKI_TEMPLATE_DEFAULT_SECTIONS[params.templateType]

  return uniqueSectionTypes([
    ...templateDefaults,
    ...params.enabledModules,
    ...params.optionalSections,
  ]).filter(sectionType => !suppressed.has(sectionType))
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return uniqueStrings(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))
}

function normalizeSectionTypeList(value: unknown, fallback: WikiSectionType[]): WikiSectionType[] {
  if (!Array.isArray(value)) {
    return uniqueSectionTypes(fallback)
  }

  return uniqueSectionTypes(value.filter(isWikiSectionType)).length > 0
    ? uniqueSectionTypes(value.filter(isWikiSectionType))
    : uniqueSectionTypes(fallback)
}

function normalizeSharedSectionList(
  value: unknown,
  fallback: typeof SHARED_SECTION_TYPES[number][],
): typeof SHARED_SECTION_TYPES[number][] {
  if (!Array.isArray(value)) {
    return uniqueSharedSectionTypes(fallback)
  }

  const sections = uniqueSharedSectionTypes(value.filter(isWikiSharedSectionType))
  return sections.length > 0 ? sections : uniqueSharedSectionTypes(fallback)
}

function normalizeOptionalSectionList(
  value: unknown,
  fallback: typeof WIKI_OPTIONAL_SECTION_TYPES[number][],
): typeof WIKI_OPTIONAL_SECTION_TYPES[number][] {
  if (!Array.isArray(value)) {
    return uniqueOptionalSectionTypes(fallback)
  }

  const sections = uniqueOptionalSectionTypes(value.filter(isWikiOptionalSectionType))
  return sections.length > 0 ? sections : uniqueOptionalSectionTypes(fallback)
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)]
}

function uniqueSectionTypes(values: WikiSectionType[]): WikiSectionType[] {
  return [...new Set(values)]
}

function uniqueSharedSectionTypes(values: typeof SHARED_SECTION_TYPES[number][]) {
  return [...new Set(values)]
}

function uniqueOptionalSectionTypes(values: typeof WIKI_OPTIONAL_SECTION_TYPES[number][]) {
  return [...new Set(values)]
}

function inferSectionFormat(sectionType: WikiSectionType): WikiSectionFormat {
  if (sectionType === 'intro') {
    return 'overview'
  }
  if (sectionType === 'sources') {
    return 'catalog'
  }
  if (['faq', 'troubleshooting', 'misunderstandings', 'open_questions'].includes(sectionType)) {
    return 'qa'
  }
  if (['viewpoints', 'controversies', 'conflict'].includes(sectionType)) {
    return 'debate'
  }
  return 'structured'
}

function defaultSectionTitle(sectionType: WikiSectionType): string {
  switch (sectionType) {
    case 'intro':
      return t('analytics.wikiPage.overviewHeading')
    case 'highlights':
      return t('analytics.wikiPage.keyDocumentsHeading')
    case 'sources':
      return t('analytics.wikiPage.evidenceHeading')
    default:
      return sectionType
  }
}

function defaultSectionFallback(sectionType: WikiSectionType): string {
  switch (sectionType) {
    case 'intro':
      return t('analytics.wiki.noClearTopicOverviewYet')
    case 'highlights':
      return t('analytics.wiki.noKeyDocumentSuggestionsYet')
    case 'sources':
      return t('analytics.wiki.noClearRelationshipEvidenceYet')
    case 'faq':
      return t('analytics.wiki.noClearFaqYet')
    case 'troubleshooting':
      return t('analytics.wiki.noClearTroubleshootingYet')
    case 'misunderstandings':
      return t('analytics.wiki.noClearMisunderstandingsYet')
    case 'open_questions':
      return t('analytics.wiki.noClearOpenQuestionsYet')
    default:
      return t('analytics.wiki.noClearStructureObservationsYet')
  }
}

function isWikiTemplateType(value: unknown): value is WikiTemplateType {
  return typeof value === 'string' && WIKI_TEMPLATE_TYPES.includes(value as WikiTemplateType)
}

function isWikiTemplateConfidence(value: unknown): value is WikiTemplateConfidence {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isWikiSectionType(value: unknown): value is WikiSectionType {
  return typeof value === 'string' && WIKI_SECTION_TYPES.includes(value as WikiSectionType)
}

function isWikiSharedSectionType(value: unknown): value is typeof SHARED_SECTION_TYPES[number] {
  return typeof value === 'string' && SHARED_SECTION_TYPES.includes(value as typeof SHARED_SECTION_TYPES[number])
}

function isWikiOptionalSectionType(value: unknown): value is typeof WIKI_OPTIONAL_SECTION_TYPES[number] {
  return typeof value === 'string' && WIKI_OPTIONAL_SECTION_TYPES.includes(value as typeof WIKI_OPTIONAL_SECTION_TYPES[number])
}

function isWikiSectionFormat(value: unknown): value is WikiSectionFormat {
  return value === 'overview' || value === 'structured' || value === 'qa' || value === 'debate' || value === 'catalog'
}
