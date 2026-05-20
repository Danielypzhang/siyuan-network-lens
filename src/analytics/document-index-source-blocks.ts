import type { SourceBlockItem } from './ai-index-store'

export interface ClassifiedSourceBlocks {
  primary: SourceBlockItem[]
  secondary: SourceBlockItem[]
}

export interface SourceBlockCandidate {
  blockId: string
  text: string
  type: string
  charCount: number
}

const PRIMARY_CHAR_THRESHOLD = 80
const SECONDARY_CHAR_THRESHOLD = 30
const PRIMARY_CAPACITY = 8
const SECONDARY_CAPACITY = 12

const BLOCK_REF_PATTERN = /\(\([0-9a-f]{22}\s+"[^"]*"\)\)/g
const INLINE_MATH_PATTERN = /\$[^$]+\$/g
const KRAMDOWN_ATTRIBUTE_PATTERN = /\{:[^}]*\}/g
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g

const LOW_VALUE_BLOCK_TYPES = new Set(['h', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

export function filterLowValueBlocks(candidates: SourceBlockCandidate[]): SourceBlockCandidate[] {
  return candidates.filter(c => {
    if (c.charCount < SECONDARY_CHAR_THRESHOLD) return false
    if (LOW_VALUE_BLOCK_TYPES.has(c.type)) return false
    if (isLinkOnlyText(c.text)) return false
    if (isFormattingOnlyText(c.text)) return false
    return true
  })
}

function isLinkOnlyText(text: string): boolean {
  const withoutLinks = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '').trim()
  return withoutLinks.length === 0
}

function isFormattingOnlyText(text: string): boolean {
  const withoutFormatting = text.replace(/[*_~`#>|-\s]/g, '').trim()
  return withoutFormatting.length === 0
}

export function classifySourceBlocks(candidates: SourceBlockCandidate[]): ClassifiedSourceBlocks {
  const primary: SourceBlockItem[] = []
  const secondary: SourceBlockItem[] = []

  for (const candidate of candidates) {
    if (candidate.charCount >= PRIMARY_CHAR_THRESHOLD && primary.length < PRIMARY_CAPACITY) {
      primary.push({ blockId: candidate.blockId, text: candidate.text })
    } else if (candidate.charCount >= SECONDARY_CHAR_THRESHOLD && secondary.length < SECONDARY_CAPACITY) {
      secondary.push({ blockId: candidate.blockId, text: candidate.text })
    }
  }

  return { primary, secondary }
}

export async function collectDocumentSourceBlocks(params: {
  documentId: string
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
  getChildBlocks: (id: string) => Promise<Array<{ id: string, type?: string, subtype?: string }>>
}): Promise<ClassifiedSourceBlocks> {
  let rootText = ''

  try {
    const { kramdown: rootKramdown } = await params.getBlockKramdown(params.documentId)
    rootText = stripKramdownMarkers(rootKramdown)
  } catch {
    // getBlockKramdown failed, try child blocks instead
  }

  if (rootText.length >= PRIMARY_CHAR_THRESHOLD) {
    return {
      primary: [{ blockId: params.documentId, text: rootText }],
      secondary: [],
    }
  }

  try {
    const candidates: SourceBlockCandidate[] = []

    const children = await params.getChildBlocks(params.documentId)
    for (const child of children) {
      try {
        const { kramdown } = await params.getBlockKramdown(child.id)
        const childText = stripKramdownMarkers(kramdown)
        if (childText) {
          candidates.push({
            blockId: child.id,
            text: childText,
            type: child.type || 'unknown',
            charCount: childText.length,
          })
        }
      } catch {
        // skip failed child blocks
      }
    }

    const filtered = filterLowValueBlocks(candidates)
    if (filtered.length > 0) {
      return classifySourceBlocks(filtered)
    }
  } catch {
    // getChildBlocks failed
  }

  if (rootText && rootText.length >= SECONDARY_CHAR_THRESHOLD) {
    const isPrimary = rootText.length >= PRIMARY_CHAR_THRESHOLD
    return {
      primary: isPrimary ? [{ blockId: params.documentId, text: rootText }] : [],
      secondary: isPrimary ? [] : [{ blockId: params.documentId, text: rootText }],
    }
  }

  return { primary: [], secondary: [] }
}

export function truncateSourceBlocksToTokenBudget(params: {
  blocks: SourceBlockItem[]
  maxInputTokens: number
  reservedPromptTokens: number
}): SourceBlockItem[] {
  const availableTokens = Math.max(0, params.maxInputTokens - params.reservedPromptTokens)
  const maxChars = availableTokens * CHARS_PER_TOKEN
  let totalChars = 0
  const result: SourceBlockItem[] = []
  for (const block of params.blocks) {
    if (totalChars + block.text.length > maxChars) {
      const remaining = maxChars - totalChars
      if (remaining > CHARS_PER_TOKEN * 50) {
        result.push({ ...block, text: block.text.slice(0, remaining) })
      }
      break
    }
    result.push(block)
    totalChars += block.text.length
  }
  return result
}

const CHARS_PER_TOKEN = 2.5

function stripKramdownMarkers(kramdown: string): string {
  return kramdown
    .replace(BLOCK_REF_PATTERN, '')
    .replace(INLINE_MATH_PATTERN, '')
    .replace(KRAMDOWN_ATTRIBUTE_PATTERN, '')
    .replace(MARKDOWN_IMAGE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
}
