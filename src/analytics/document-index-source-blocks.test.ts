import { describe, expect, it } from 'vitest'

import {
  classifySourceBlocks,
  collectDocumentSourceBlocks,
  filterLowValueBlocks,
  type SourceBlockCandidate,
} from './document-index-source-blocks'

function makeCandidate(overrides: Partial<SourceBlockCandidate> & Pick<SourceBlockCandidate, 'blockId'>): SourceBlockCandidate {
  return {
    text: 'A'.repeat(100),
    type: 'p',
    charCount: 100,
    ...overrides,
  }
}

describe('filterLowValueBlocks', () => {
  it('removes blocks shorter than threshold', () => {
    const candidates = [
      makeCandidate({ blockId: 'short', text: 'hi', charCount: 2 }),
      makeCandidate({ blockId: 'ok', text: 'A'.repeat(40), charCount: 40 }),
    ]
    const result = filterLowValueBlocks(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].blockId).toBe('ok')
  })

  it('removes link-only blocks', () => {
    const candidates = [
      makeCandidate({
        blockId: 'links',
        text: '[Page A](siyuan://blocks/aaa) [Page B](siyuan://blocks/bbb)',
        charCount: 60,
      }),
      makeCandidate({ blockId: 'prose', text: 'This is real content with enough characters to pass.', charCount: 52 }),
    ]
    const result = filterLowValueBlocks(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].blockId).toBe('prose')
  })

  it('removes pure formatting blocks', () => {
    const candidates = [
      makeCandidate({ blockId: 'formatting', text: '* * * * * * * * * * * * * * * * * * * * * * * * * * * * * *', charCount: 60 }),
      makeCandidate({ blockId: 'content', text: 'Real content with substance and meaning here in this text block.' , charCount: 63 }),
    ]
    const result = filterLowValueBlocks(candidates)
    expect(result).toHaveLength(1)
    expect(result[0].blockId).toBe('content')
  })

  it('keeps substantive paragraphs', () => {
    const candidates = [
      makeCandidate({ blockId: 'p1', text: 'This is a meaningful paragraph about knowledge management systems and their role in personal productivity.', charCount: 108 }),
      makeCandidate({ blockId: 'p2', text: 'Another substantial paragraph discussing the relationship between notes and ideas in a Zettelkasten.', charCount: 96 }),
    ]
    const result = filterLowValueBlocks(candidates)
    expect(result).toHaveLength(2)
  })
})

describe('classifySourceBlocks', () => {
  it('separates primary and secondary blocks by char count', () => {
    const filtered = [
      makeCandidate({ blockId: 'long', text: 'A'.repeat(100), charCount: 100 }),
      makeCandidate({ blockId: 'medium', text: 'B'.repeat(50), charCount: 50 }),
    ]
    const result = classifySourceBlocks(filtered)
    expect(result.primary).toHaveLength(1)
    expect(result.primary[0].blockId).toBe('long')
    expect(result.secondary).toHaveLength(1)
    expect(result.secondary[0].blockId).toBe('medium')
  })

  it('respects primary capacity limit', () => {
    const filtered = Array.from({ length: 12 }, (_, i) =>
      makeCandidate({ blockId: `p${i}`, text: 'A'.repeat(100), charCount: 100 }),
    )
    const result = classifySourceBlocks(filtered)
    expect(result.primary).toHaveLength(8)
    expect(result.secondary).toHaveLength(4)
  })

  it('respects secondary capacity limit', () => {
    const filtered = Array.from({ length: 20 }, (_, i) =>
      makeCandidate({ blockId: `s${i}`, text: 'B'.repeat(40), charCount: 40 }),
    )
    const result = classifySourceBlocks(filtered)
    expect(result.primary).toHaveLength(0)
    expect(result.secondary).toHaveLength(12)
  })
})

describe('collectDocumentSourceBlocks', () => {
  it('uses root kramdown directly for document blocks', async () => {
    const longContent = 'This is a document block with enough content to be considered a primary source block for the AI indexing pipeline.'
    const result = await collectDocumentSourceBlocks({
      documentId: 'doc-1',
      getBlockKramdown: async (id) => ({ id, kramdown: longContent }),
      getChildBlocks: async () => [],
      getBlockType: async () => 'd',
    })

    expect(result.primary).toHaveLength(1)
    expect(result.primary[0].blockId).toBe('doc-1')
    expect(result.primary[0].text).toBe(longContent)
  })

  it('uses root kramdown directly for paragraph blocks', async () => {
    const longContent = 'This is a paragraph block with enough content to be considered a primary source block for the AI indexing pipeline.'
    const result = await collectDocumentSourceBlocks({
      documentId: 'para-1',
      getBlockKramdown: async (id) => ({ id, kramdown: longContent }),
      getChildBlocks: async () => [],
      getBlockType: async () => 'p',
    })

    expect(result.primary).toHaveLength(1)
    expect(result.primary[0].blockId).toBe('para-1')
  })

  it('fetches child blocks for heading blocks', async () => {
    const childBlocks = [
      { id: 'b1', type: 'p' },
      { id: 'b2', type: 'h2' },
      { id: 'b3', type: 'p' },
      { id: 'b4', type: 'p' },
    ]
    const kramdownMap: Record<string, string> = {
      'heading-1': 'Short heading',
      b1: 'This is a long enough paragraph about AI indexing with meaningful content for classification.',
      b3: 'Short note.',
      b4: 'Another substantial paragraph discussing the implications of knowledge graphs in personal note-taking systems.',
    }

    const result = await collectDocumentSourceBlocks({
      documentId: 'heading-1',
      getChildBlocks: async () => childBlocks,
      getBlockKramdown: async (id) => ({ id, kramdown: kramdownMap[id] || '' }),
      getBlockType: async () => 'h',
    })

    expect(result.primary.length + result.secondary.length).toBeGreaterThanOrEqual(1)
    expect(result.primary.some(b => b.blockId === 'b1') || result.secondary.some(b => b.blockId === 'b1')).toBe(true)
  })

  it('fetches child blocks for list blocks', async () => {
    const childBlocks = [
      { id: 'l1', type: 'p' },
      { id: 'l2', type: 'p' },
    ]
    const kramdownMap: Record<string, string> = {
      'list-1': '- item',
      l1: 'First list item content that is long enough to pass the threshold for classification.',
      l2: 'Second list item content that is also long enough to pass the threshold for classification.',
    }

    const result = await collectDocumentSourceBlocks({
      documentId: 'list-1',
      getChildBlocks: async () => childBlocks,
      getBlockKramdown: async (id) => ({ id, kramdown: kramdownMap[id] || '' }),
      getBlockType: async () => 'l',
    })

    expect(result.primary.length + result.secondary.length).toBeGreaterThanOrEqual(1)
  })

  it('falls back to text length heuristic when getBlockType is unavailable', async () => {
    const longContent = 'This is a document block with enough content to be considered a primary source block for the AI indexing pipeline.'
    const result = await collectDocumentSourceBlocks({
      documentId: 'doc-1',
      getBlockKramdown: async (id) => ({ id, kramdown: longContent }),
      getChildBlocks: async () => [],
    })

    expect(result.primary).toHaveLength(1)
    expect(result.primary[0].blockId).toBe('doc-1')
  })

  it('handles blocks that fail to load gracefully', async () => {
    const childBlocks = [
      { id: 'ok', type: 'p' },
      { id: 'fail', type: 'p' },
    ]

    const result = await collectDocumentSourceBlocks({
      documentId: 'heading-1',
      getChildBlocks: async () => childBlocks,
      getBlockKramdown: async (id) => {
        if (id === 'fail') throw new Error('API error')
        if (id === 'heading-1') return { id, kramdown: 'Short heading' }
        return { id, kramdown: 'This is a valid paragraph with enough content for classification.' }
      },
      getBlockType: async () => 'h',
    })

    expect(result.primary.length + result.secondary.length).toBe(1)
  })

  it('returns empty when heading block has no children with sufficient content', async () => {
    const result = await collectDocumentSourceBlocks({
      documentId: 'heading-1',
      getChildBlocks: async () => [],
      getBlockKramdown: async (id) => ({ id, kramdown: 'Short' }),
      getBlockType: async () => 'h',
    })

    expect(result.primary).toHaveLength(0)
    expect(result.secondary).toHaveLength(0)
  })
})
