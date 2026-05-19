export const WIKI_TEMPLATE_TYPES = [
  'tech_topic',
  'product_howto',
  'social_topic',
  'media_list',
] as const
export type WikiTemplateType = typeof WIKI_TEMPLATE_TYPES[number]

export const WIKI_SHARED_SECTION_TYPES = ['intro', 'highlights', 'sources'] as const
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

const DEFAULT_SECTION_GOALS: Partial<Record<WikiTemplateType, Partial<Record<WikiSectionType, string>>>> = {
  tech_topic: {
    intro: '简要概述本主题的核心技术要点，不列举文档。',
    core_principles: '提炼支撑本主题的关键原理和机制。',
    method_path: '梳理实现或应用本主题的方法路径。',
    use_cases: '收集本主题的实际应用场景和案例。',
    sources: '汇总源文档间的引用关系和技术关联。',
  },
  product_howto: {
    intro: '概述产品的核心功能和操作目标。',
    basic_steps: '分步骤说明基本的操作流程。',
    advanced_usage: '补充进阶配置和高级操作方法。',
    faq: '整理常见的操作疑问和解答。',
    sources: '汇总操作文档间的步骤衔接关系。',
  },
  social_topic: {
    intro: '概述话题背景和社会意义。',
    viewpoints: '整理不同立场和观点。',
    controversies: '梳理争议焦点和核心矛盾。',
    impacts: '分析话题的社会影响和后果。',
    sources: '汇总观点间的支持和对立关系。',
  },
  media_list: {
    intro: '概述作品集的主题范围和整体特点。',
    representative_works: '推荐代表性作品并说明理由。',
    comparison: '对比不同作品的风格和特点。',
    reading_order: '建议阅读/观看的顺序。',
    sources: '汇总作品间的关联和参考关系。',
  },
}

const DEFAULT_SECTION_FORMATS: Partial<Record<WikiSectionType, WikiSectionFormat>> = {
  intro: 'overview',
  core_principles: 'structured',
  method_path: 'structured',
  use_cases: 'structured',
  basic_steps: 'structured',
  advanced_usage: 'structured',
  faq: 'qa',
  troubleshooting: 'qa',
  viewpoints: 'debate',
  controversies: 'debate',
  open_questions: 'overview',
  cases: 'structured',
  impacts: 'structured',
  work_map: 'structured',
  representative_works: 'catalog',
  reading_order: 'catalog',
  comparison: 'structured',
  misunderstandings: 'structured',
  conflict: 'debate',
}

export function buildManualPagePlan(diagnosis: WikiTemplateDiagnosis): WikiPagePlan {
  const templateType = diagnosis.templateType
  const defaultSections = WIKI_TEMPLATE_DEFAULT_SECTIONS[templateType] || ['intro', 'sources']
  const templateGoals = DEFAULT_SECTION_GOALS[templateType] || {}
  const sectionGoals: WikiPagePlan['sectionGoals'] = {}
  const sectionFormats: WikiPagePlan['sectionFormats'] = {}

  for (const sectionType of defaultSections) {
    if (templateGoals[sectionType]) {
      sectionGoals[sectionType] = templateGoals[sectionType]
    }
    if (DEFAULT_SECTION_FORMATS[sectionType]) {
      sectionFormats[sectionType] = DEFAULT_SECTION_FORMATS[sectionType]
    }
  }

  const coreSections = defaultSections.filter(s =>
    WIKI_SHARED_SECTION_TYPES.includes(s as typeof WIKI_SHARED_SECTION_TYPES[number]),
  ) as WikiSharedSectionType[]
  const optionalSections = defaultSections.filter(s =>
    WIKI_OPTIONAL_SECTION_TYPES.includes(s as typeof WIKI_OPTIONAL_SECTION_TYPES[number]),
  ) as WikiOptionalSectionType[]

  return {
    templateType,
    confidence: 'high',
    coreSections,
    optionalSections,
    sectionOrder: [...defaultSections],
    sectionGoals,
    sectionFormats,
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
