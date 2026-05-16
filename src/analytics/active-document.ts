import type { EventBus, IProtyle } from 'siyuan'

const ACTIVE_DOCUMENT_EVENTS = [
  'switch-protyle',
  'loaded-protyle-static',
  'loaded-protyle-dynamic',
] as const

type ActiveDocumentEvent = typeof ACTIVE_DOCUMENT_EVENTS[number]

export function resolveProtyleDocumentId(protyle?: IProtyle | null): string {
  if (!protyle) {
    return ''
  }
  return protyle.block?.rootID || protyle.block?.id || protyle.id || ''
}

export function resolveProtyleZoomBlockId(protyle?: IProtyle | null): { blockId: string, isZoomedIn: boolean } | null {
  if (!protyle?.block) {
    return null
  }
  const blockId = protyle.block.id
  const rootId = protyle.block.rootID
  if (!blockId || !rootId) {
    return null
  }
  const isZoomedIn = blockId !== rootId
  return { blockId: isZoomedIn ? blockId : rootId, isZoomedIn }
}

export function createActiveDocumentSync(params: {
  eventBus: Pick<EventBus, 'on' | 'off'>
  onDocumentId: (documentId: string) => void
  onZoomBlockId?: (result: { blockId: string, isZoomedIn: boolean } | null) => void
}) {
  const handler = (event: { detail?: { protyle?: IProtyle } }) => {
    const documentId = resolveProtyleDocumentId(event.detail?.protyle)
    if (documentId) {
      params.onDocumentId(documentId)
    }
    if (params.onZoomBlockId) {
      params.onZoomBlockId(resolveProtyleZoomBlockId(event.detail?.protyle))
    }
  }

  for (const event of ACTIVE_DOCUMENT_EVENTS) {
    params.eventBus.on(event as ActiveDocumentEvent, handler)
  }

  return () => {
    for (const event of ACTIVE_DOCUMENT_EVENTS) {
      params.eventBus.off(event as ActiveDocumentEvent, handler)
    }
  }
}
