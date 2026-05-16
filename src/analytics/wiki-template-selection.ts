import {
  WIKI_SECTION_TYPES,
  WIKI_TEMPLATE_DEFAULT_SECTIONS,
  type WikiSectionType,
  type WikiTemplateType,
} from './wiki-template-model'

export function resolveSectionOrder(params: {
  templateType?: WikiTemplateType
  enabledModules?: WikiSectionType[]
  confidence?: string
  aiSectionOrder?: WikiSectionType[]
}): WikiSectionType[] {
  const { aiSectionOrder, templateType } = params

  if (
    aiSectionOrder
    && aiSectionOrder.length > 0
    && aiSectionOrder.every(item => WIKI_SECTION_TYPES.includes(item))
  ) {
    const withoutSources = aiSectionOrder.filter(s => s !== 'sources')
    const hasSources = aiSectionOrder.includes('sources')
    return hasSources ? [...withoutSources, 'sources'] : withoutSources
  }

  const resolvedType = templateType ?? 'tech_topic'
  return [...WIKI_TEMPLATE_DEFAULT_SECTIONS[resolvedType]]
}
