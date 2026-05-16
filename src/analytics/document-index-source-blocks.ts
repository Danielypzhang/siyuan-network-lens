import type { SourceBlockItem } from './ai-index-store'

export interface ClassifiedSourceBlocks {
  primary: SourceBlockItem[]
  secondary: SourceBlockItem[]
}

const PRIMARY_CHAR_THRESHOLD = 80
const SECONDARY_CHAR_THRESHOLD = 30
const MAX_SOURCE_BLOCK_CHARS = 12000

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
      const truncated = plainText.length > MAX_SOURCE_BLOCK_CHARS
        ? plainText.slice(0, MAX_SOURCE_BLOCK_CHARS)
        : plainText
      const isPrimary = truncated.length >= PRIMARY_CHAR_THRESHOLD
      return {
        primary: isPrimary ? [{ blockId: params.documentId, text: truncated }] : [],
        secondary: isPrimary ? [] : [{ blockId: params.documentId, text: truncated }],
      }
    }
  } catch {
    // block kramdown failed
  }
  return { primary: [], secondary: [] }
}

function stripKramdownMarkers(kramdown: string): string {
  return kramdown
    .replace(BLOCK_REF_PATTERN, '')
    .replace(INLINE_MATH_PATTERN, '')
    .replace(KRAMDOWN_ATTRIBUTE_PATTERN, '')
    .replace(MARKDOWN_IMAGE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
}
