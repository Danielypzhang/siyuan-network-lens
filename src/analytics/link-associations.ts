import type { DocumentRecord, ReferenceRecord, TimeRange } from './analysis'
import { filterReferencesByTimeRange } from './analysis'
import { isChildPath, normalizePath, toChildPathPrefix } from './analysis-context'
import { sql } from '@/api'

export interface LinkAssociationItem {
  documentId: string
  title: string
  direction: 'outbound' | 'inbound' | 'child'
  isOverlap: boolean
}

export interface LinkAssociations {
  outbound: LinkAssociationItem[]
  inbound: LinkAssociationItem[]
  childDocuments: LinkAssociationItem[]
}

const SIYUAN_BLOCK_URL_PATTERN = /siyuan:\/\/blocks\/([^?\s<>"')\]#]+)/gi
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)\)/g

export function extractKramdownDocumentIds(kramdown: string): string[] {
  const ids = new Set<string>()
  for (const match of kramdown.matchAll(SIYUAN_BLOCK_URL_PATTERN)) {
    ids.add(match[1])
  }
  for (const match of kramdown.matchAll(BLOCK_REFERENCE_PATTERN)) {
    ids.add(match[1])
  }
  return [...ids]
}

export async function fetchOutboundBlockRefDocumentIds(documentId: string): Promise<string[]> {
  const escapedId = documentId.replace(/'/g, "''")
  const rows = await sql(
    `SELECT DISTINCT r.def_block_root_id AS documentId
     FROM refs r
     WHERE r.type = 'ref_id'
       AND r.root_id = '${escapedId}'
       AND r.def_block_root_id != '${escapedId}'`
  ) as Array<{ documentId: string }>
  return rows.map(row => row.documentId)
}

export function buildLinkAssociations(params: {
  documentId: string
  references: ReferenceRecord[]
  documentMap: Map<string, DocumentRecord>
  childDocumentMap?: Map<string, DocumentRecord>
  now: Date
  timeRange: TimeRange
  extraOutboundDocumentIds?: string[]
}): LinkAssociations {
  const outboundTargets = new Set<string>()
  const inboundSources = new Set<string>()
  const filteredReferences = filterReferencesByTimeRange({
    references: params.references,
    now: params.now,
    timeRange: params.timeRange,
  })

  for (const reference of filteredReferences) {
    if (reference.sourceDocumentId === reference.targetDocumentId) {
      continue
    }
    if (!params.documentMap.has(reference.sourceDocumentId) || !params.documentMap.has(reference.targetDocumentId)) {
      continue
    }
    if (reference.sourceDocumentId === params.documentId) {
      outboundTargets.add(reference.targetDocumentId)
    }
    if (reference.targetDocumentId === params.documentId) {
      inboundSources.add(reference.sourceDocumentId)
    }
  }

  if (params.extraOutboundDocumentIds) {
    for (const targetId of params.extraOutboundDocumentIds) {
      if (targetId === params.documentId) continue
      outboundTargets.add(targetId)
    }
  }

  const overlap = new Set<string>([...outboundTargets].filter(documentId => inboundSources.has(documentId)))

  const outbound = buildAssociationList({
    documentIds: outboundTargets,
    documentMap: params.documentMap,
    overlap,
    direction: 'outbound',
    includeMissing: true,
  })
  const inbound = buildAssociationList({
    documentIds: inboundSources,
    documentMap: params.documentMap,
    overlap,
    direction: 'inbound',
  })
  const childDocuments = buildChildAssociationList({
    coreDocumentId: params.documentId,
    documentMap: params.childDocumentMap ?? params.documentMap,
    excluded: new Set([...outboundTargets, ...inboundSources]),
  })

  return { outbound, inbound, childDocuments }
}

function buildAssociationList(params: {
  documentIds: Set<string>
  documentMap: Map<string, DocumentRecord>
  overlap: Set<string>
  direction: LinkAssociationItem['direction']
  includeMissing?: boolean
}): LinkAssociationItem[] {
  return [...params.documentIds]
    .map((documentId) => {
      const document = params.documentMap.get(documentId)
      if (!document) {
        if (params.includeMissing) {
          return {
            documentId,
            title: documentId,
            direction: params.direction,
            isOverlap: params.overlap.has(documentId),
          }
        }
        return null
      }
      return {
        documentId,
        title: resolveTitle(document),
        direction: params.direction,
        isOverlap: params.overlap.has(documentId),
      }
    })
    .filter((item): item is LinkAssociationItem => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

function resolveTitle(document: DocumentRecord): string {
  return document.title || document.name || document.content || document.hpath || document.id
}

function buildChildAssociationList(params: {
  coreDocumentId: string
  documentMap: Map<string, DocumentRecord>
  excluded: Set<string>
}): LinkAssociationItem[] {
  const coreDocument = params.documentMap.get(params.coreDocumentId)
  if (!coreDocument) {
    return []
  }

  return [...params.documentMap.values()]
    .filter((candidate) => {
      if (candidate.id === params.coreDocumentId) {
        return false
      }
      if (params.excluded.has(candidate.id)) {
        return false
      }
      return isChildDocument(coreDocument, candidate)
    })
    .map(candidate => ({
      documentId: candidate.id,
      title: resolveTitle(candidate),
      direction: 'child' as const,
      isOverlap: false,
    }))
    .sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'))
}

function isChildDocument(parent: Partial<DocumentRecord>, candidate: Partial<DocumentRecord>): boolean {
  if (parent.box && candidate.box && parent.box !== candidate.box) {
    return false
  }

  if (parent.path && candidate.path && isChildPath(parent.path, candidate.path)) {
    return true
  }

  const hierarchyPrefix = toChildPathPrefix(parent.hpath)
  if (hierarchyPrefix && normalizePath(candidate.hpath).startsWith(hierarchyPrefix)) {
    return true
  }

  return false
}
