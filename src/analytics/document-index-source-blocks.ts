import type { SourceBlockItem } from './ai-index-store'

export interface ClassifiedSourceBlocks {
  primary: SourceBlockItem[]
  secondary: SourceBlockItem[]
}

const PRIMARY_CHAR_THRESHOLD = 80
const SECONDARY_CHAR_THRESHOLD = 30

const BLOCK_REF_PATTERN = /\(\([0-9a-f]{22}\s+"[^"]*"\)\)/g
const INLINE_MATH_PATTERN = /\$[^$]+\$/g
const KRAMDOWN_ATTRIBUTE_PATTERN = /\{:[^}]*\}/g
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g

export async function collectDocumentSourceBlocks(params: {
  documentId: string
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
}): Promise<ClassifiedSourceBlocks> {
  try {
    const { kramdown } = await params.getBlockKramdown(params.documentId)
    const plainText = stripKramdownMarkers(kramdown)
    if (plainText && plainText.length >= SECONDARY_CHAR_THRESHOLD) {
      const isPrimary = plainText.length >= PRIMARY_CHAR_THRESHOLD
      return {
        primary: isPrimary ? [{ blockId: params.documentId, text: plainText }] : [],
        secondary: isPrimary ? [] : [{ blockId: params.documentId, text: plainText }],
      }
    }
  } catch {
    // block kramdown failed
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
