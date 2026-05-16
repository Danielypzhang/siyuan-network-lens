import { describe, expect, it } from 'vitest'

import { WIKI_TEMPLATE_DEFAULT_SECTIONS } from './wiki-template-model'
import { resolveSectionOrder } from './wiki-template-selection'

describe('wiki template selection', () => {
  it('uses aiSectionOrder when valid, ensuring sources at the end', () => {
    expect(resolveSectionOrder({
      templateType: 'tech_topic',
      aiSectionOrder: ['intro', 'core_principles', 'use_cases', 'sources'],
    })).toEqual(['intro', 'core_principles', 'use_cases', 'sources'])
  })

  it('moves sources to the end when aiSectionOrder places it elsewhere', () => {
    expect(resolveSectionOrder({
      templateType: 'tech_topic',
      aiSectionOrder: ['sources', 'intro', 'core_principles'],
    })).toEqual(['intro', 'core_principles', 'sources'])
  })

  it('falls back to template defaults when aiSectionOrder is empty', () => {
    expect(resolveSectionOrder({
      templateType: 'social_topic',
      aiSectionOrder: [],
    })).toEqual(WIKI_TEMPLATE_DEFAULT_SECTIONS.social_topic)
  })

  it('falls back to template defaults when aiSectionOrder contains invalid types', () => {
    expect(resolveSectionOrder({
      templateType: 'product_howto',
      aiSectionOrder: ['intro', 'invalid_section', 'sources'] as any,
    })).toEqual(WIKI_TEMPLATE_DEFAULT_SECTIONS.product_howto)
  })

  it('falls back to template defaults when aiSectionOrder is not provided', () => {
    expect(resolveSectionOrder({
      templateType: 'media_list',
    })).toEqual(WIKI_TEMPLATE_DEFAULT_SECTIONS.media_list)
  })

  it('falls back to tech_topic defaults when templateType is also missing', () => {
    expect(resolveSectionOrder({})).toEqual(WIKI_TEMPLATE_DEFAULT_SECTIONS.tech_topic)
  })
})
