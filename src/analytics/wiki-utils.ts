export function parseJsonArray<T>(value?: string): T[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function resolveDocumentFallbackTitle(document: { title?: string, hpath?: string, path?: string } | undefined, fallbackId: string): string {
  return document?.title || document?.hpath || document?.path || fallbackId
}
