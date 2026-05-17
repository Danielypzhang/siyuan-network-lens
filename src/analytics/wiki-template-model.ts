export const WIKI_TEMPLATE_TYPES = [
  'tech_topic',
  'product_howto',
  'social_topic',
  'media_list',
] as const
export type WikiTemplateType = typeof WIKI_TEMPLATE_TYPES[number]

const WIKI_SHARED_SECTION_TYPES = ['intro', 'highlights', 'sources'] as const
export type WikiSharedSectionType = typeof WIKI_SHARED_SECTION_TYPES[number]

export const WIKI_OPTIONAL_SECTION_TYPES = [
  'core_principles',
  'method_path',
  'use_cases',
  'basic_steps',
  'advanced_usage',
  'faq',
  'troubleshooting',
  'viewpoints',
  'controversies',
  'open_questions',
  'cases',
  'impacts',
  'work_map',
  'representative_works',
  'reading_order',
  'comparison',
  'misunderstandings',
  'conflict',
] as const
export type WikiOptionalSectionType = typeof WIKI_OPTIONAL_SECTION_TYPES[number]

export const WIKI_SECTION_TYPES = [...WIKI_SHARED_SECTION_TYPES, ...WIKI_OPTIONAL_SECTION_TYPES] as const
export type WikiSectionType = typeof WIKI_SECTION_TYPES[number]

export const WIKI_TEMPLATE_DEFAULT_SECTIONS: Record<WikiTemplateType, WikiSectionType[]> = {
  tech_topic: ['intro', 'core_principles', 'method_path', 'use_cases', 'sources'],
  product_howto: ['intro', 'basic_steps', 'advanced_usage', 'faq', 'sources'],
  social_topic: ['intro', 'viewpoints', 'controversies', 'impacts', 'sources'],
  media_list: ['intro', 'representative_works', 'comparison', 'reading_order', 'sources'],
}

export function buildManualTemplateDiagnosis(templateType: WikiTemplateType): WikiTemplateDiagnosis {
  const enabledModules = WIKI_TEMPLATE_DEFAULT_SECTIONS[templateType]
  const allOptional = WIKI_OPTIONAL_SECTION_TYPES as readonly string[]
  const suppressedModules = allOptional.filter(m => !enabledModules.includes(m as WikiSectionType)) as WikiSectionType[]
  return {
    templateType,
    confidence: 'high',
    reason: `Manually specified template type: ${templateType}`,
    enabledModules,
    suppressedModules,
    evidenceSummary: `User selected ${templateType} template`,
  }
}

export type WikiSectionFormat = 'overview' | 'structured' | 'qa' | 'debate' | 'catalog'

export type WikiTemplateConfidence = 'high' | 'medium' | 'low'

export interface WikiTemplateDiagnosis {
  templateType: WikiTemplateType
  confidence: WikiTemplateConfidence
  reason: string
  enabledModules: WikiSectionType[]
  suppressedModules: WikiSectionType[]
  evidenceSummary: string
}

export interface WikiSectionDraft {
  sectionType: WikiSectionType
  title: string
  format: WikiSectionFormat
  blocks: Array<{ text: string, sourceRefs: string[] }>
  sourceRefs: string[]
}

export interface WikiPagePlan {
  templateType: WikiTemplateType
  confidence: WikiTemplateConfidence
  coreSections: WikiSharedSectionType[]
  optionalSections: WikiOptionalSectionType[]
  sectionOrder: WikiSectionType[]
  sectionGoals: Partial<Record<WikiSectionType, string>>
  sectionFormats: Partial<Record<WikiSectionType, WikiSectionFormat>>
}
