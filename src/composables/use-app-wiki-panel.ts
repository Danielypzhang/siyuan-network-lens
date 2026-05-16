import { ref, type ComputedRef } from 'vue'

import { fetchOutboundBlockRefDocRefs, fetchKramdownOutboundDocRefs, resolveBlockIdsToRootDocIds } from '@/analytics/link-associations'
import { buildSiyuanBlockLinkMarkdown } from '@/analytics/link-sync'
import { normalizeWikiSourceDocLinkTypes, type WikiSourceDocLinkType } from '@/analytics/wiki-source-docs'
import { t } from '@/i18n/ui'
import type { WikiPreviewRequest } from './use-analytics-wiki'

type DocumentIdItem = { documentId: string }

type LinkAssociations = {
  outbound: DocumentIdItem[]
  inbound: DocumentIdItem[]
  childDocuments: DocumentIdItem[]
}

function pushLinkType(map: Map<string, WikiSourceDocLinkType[]>, documentId: string, type: WikiSourceDocLinkType) {
  const current = map.get(documentId) ?? []
  map.set(documentId, normalizeWikiSourceDocLinkTypes([...current, type]))
}

export function createAppWikiPanelController(params: {
  filteredDocuments: ComputedRef<Array<{ id: string }>>
  resolveLinkAssociations: (documentId: string) => LinkAssociations
  resolveTitle: (documentId: string) => string
  prepareWikiPreview: (request?: WikiPreviewRequest) => Promise<void>
  onSwitchDocument: (themeDocumentId: string) => void | Promise<void>
  getBlockKramdown?: (id: string) => Promise<{ id: string; kramdown: string }>
}) {
  const wikiPanelPlacement = ref<'ranking' | ''>('')
  const wikiPanelCoreDocumentId = ref('')
  const activeWikiPreviewRequest = ref<WikiPreviewRequest | null>(null)

  function isCoreDocumentWikiPanelVisible(documentId: string) {
    return wikiPanelPlacement.value === 'ranking' && wikiPanelCoreDocumentId.value === documentId
  }

  async function prepareCurrentWikiPreview() {
    await params.prepareWikiPreview(activeWikiPreviewRequest.value ?? undefined)
  }

  async function toggleCoreDocumentWikiPanel(documentId: string) {
    if (isCoreDocumentWikiPanelVisible(documentId)) {
      wikiPanelPlacement.value = ''
      wikiPanelCoreDocumentId.value = ''
      return
    }

    await params.onSwitchDocument(documentId)

    const associations = params.resolveLinkAssociations(documentId)
    const sourceDocumentIds = [
      documentId,
      ...associations.outbound.map(item => item.documentId),
      ...associations.inbound.map(item => item.documentId),
      ...associations.childDocuments.map(item => item.documentId),
    ]

    const sourceDocumentLinkTypes = new Map<string, WikiSourceDocLinkType[]>()
    for (const item of associations.outbound) {
      pushLinkType(sourceDocumentLinkTypes, item.documentId, 'outbound')
    }
    for (const item of associations.inbound) {
      pushLinkType(sourceDocumentLinkTypes, item.documentId, 'inbound')
    }
    for (const item of associations.childDocuments) {
      pushLinkType(sourceDocumentLinkTypes, item.documentId, 'child')
    }

    const knownDocIds = new Set(sourceDocumentIds)
    const blockRefIds: string[] = []

    try {
      const blockRefDocs = await fetchOutboundBlockRefDocRefs(documentId)
      for (const ref of blockRefDocs) {
        if (knownDocIds.has(ref.documentId)) continue
        blockRefIds.push(ref.documentId)
      }
    } catch {
      // SQL failed, continue with kramdown fallback
    }

    if (params.getBlockKramdown) {
      try {
        const { kramdown } = await params.getBlockKramdown(documentId)
        const kramdownRefs = await fetchKramdownOutboundDocRefs(kramdown)
        for (const ref of kramdownRefs) {
          if (knownDocIds.has(ref.documentId) || blockRefIds.includes(ref.documentId)) continue
          blockRefIds.push(ref.documentId)
        }
      } catch {
        // kramdown failed
      }
    }

    if (blockRefIds.length > 0) {
      try {
        const blockToRootMap = await resolveBlockIdsToRootDocIds(blockRefIds)
        for (const blockId of blockRefIds) {
          const rootDocId = blockToRootMap.get(blockId)
          if (rootDocId && rootDocId !== documentId && !knownDocIds.has(rootDocId)) {
            knownDocIds.add(rootDocId)
            sourceDocumentIds.push(rootDocId)
            pushLinkType(sourceDocumentLinkTypes, rootDocId, 'outbound')
          }
        }
      } catch {
        // resolveBlockIdsToRootDocIds failed, add block IDs as-is
        for (const blockId of blockRefIds) {
          if (blockId !== documentId && !knownDocIds.has(blockId)) {
            knownDocIds.add(blockId)
            sourceDocumentIds.push(blockId)
            pushLinkType(sourceDocumentLinkTypes, blockId, 'outbound')
          }
        }
      }
    }

    activeWikiPreviewRequest.value = {
      sourceDocumentIds: [...new Set(sourceDocumentIds)],
      sourceDocumentLinkTypes,
      scopeDescriptionLine: t('analytics.wiki.scopeSourceRelatedRange', { title: buildSiyuanBlockLinkMarkdown(documentId, params.resolveTitle(documentId)) }),
      themeDocumentId: documentId,
    }
    wikiPanelPlacement.value = 'ranking'
    wikiPanelCoreDocumentId.value = documentId
  }

  return {
    wikiPanelPlacement,
    wikiPanelCoreDocumentId,
    activeWikiPreviewRequest,
    isCoreDocumentWikiPanelVisible,
    prepareCurrentWikiPreview,
    toggleCoreDocumentWikiPanel,
  }
}
