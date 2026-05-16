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
const BLOCK_REFERENCE_PATTERN = /\(\(\s*([^)\s"']+)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*\)\)/g

export interface ExtractedDocRef {
  documentId: string
  anchorText?: string
}

export function extractKramdownBlockRefs(kramdown: string): { blockId: string; anchorText?: string }[] {
  const map = new Map<string, { blockId: string; anchorText?: string }>()
  for (const match of kramdown.matchAll(SIYUAN_BLOCK_URL_PATTERN)) {
    const id = match[1]
    if (!map.has(id)) {
      map.set(id, { blockId: id })
    }
  }
  for (const match of kramdown.matchAll(BLOCK_REFERENCE_PATTERN)) {
    const id = match[1]
    const anchor = match[2] || match[3]
    const existing = map.get(id)
    if (!existing) {
      map.set(id, { blockId: id, anchorText: anchor || undefined })
    } else if (!existing.anchorText && anchor) {
      existing.anchorText = anchor
    }
  }
  return [...map.values()]
}

export async function fetchOutboundBlockRefDocRefs(documentId: string): Promise<ExtractedDocRef[]> {
  const escapedId = documentId.replace(/'/g, "''")
  const rows = await sql(
    `SELECT r.def_block_id AS blockId,
            b.content AS blockContent
     FROM refs r
     LEFT JOIN blocks b ON b.id = r.def_block_id
     WHERE r.type = 'ref_id'
       AND r.root_id = '${escapedId}'
       AND r.def_block_root_id != '${escapedId}'`
  ) as Array<{ blockId: string; blockContent: string | null }>

  return rows.map(row => ({
    documentId: row.blockId,
    anchorText: row.blockContent || undefined,
  }))
}

export async function fetchKramdownOutboundDocRefs(kramdown: string): Promise<ExtractedDocRef[]> {
  const blockRefs = extractKramdownBlockRefs(kramdown)
  const withAnchor = blockRefs.filter(r => r.anchorText)
  const withoutAnchor = blockRefs.filter(r => !r.anchorText)

  const result = new Map<string, ExtractedDocRef>()
  for (const ref of withAnchor) {
    result.set(ref.blockId, { documentId: ref.blockId, anchorText: ref.anchorText })
  }

  if (withoutAnchor.length > 0) {
    const ids = withoutAnchor.map(r => `'${r.blockId.replace(/'/g, "''")}'`).join(',')
    const rows = await sql(
      `SELECT id AS blockId, content AS blockContent FROM blocks WHERE id IN (${ids})`
    ) as Array<{ blockId: string; blockContent: string | null }>
    for (const row of rows) {
      if (!result.has(row.blockId)) {
        result.set(row.blockId, {
          documentId: row.blockId,
          anchorText: row.blockContent || undefined,
        })
      }
    }
  }

  return [...result.values()]
}

export async function fetchBlockDocumentRecords(blockIds: string[]): Promise<Map<string, DocumentRecord>> {
  if (blockIds.length === 0) return new Map()
  const ids = blockIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',')
  const rows = await sql(
    `SELECT id, box, path, hpath, content, root_id AS rootId
     FROM blocks WHERE id IN (${ids})`
  ) as Array<{ id: string; box: string; path: string; hpath: string; content: string | null; rootId: string }>
  const map = new Map<string, DocumentRecord>()
  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      box: row.box,
      path: row.path,
      hpath: row.hpath,
      title: row.content || row.id,
      content: row.content || '',
      created: '',
      updated: '',
    })
  }
  return map
}

export function buildLinkAssociations(params: {
  documentId: string
  references: ReferenceRecord[]
  documentMap: Map<string, DocumentRecord>
  childDocumentMap?: Map<string, DocumentRecord>
  now: Date
  timeRange: TimeRange
  extraOutboundRefs?: ExtractedDocRef[]
}): LinkAssociations {
  const outboundTargets = new Set<string>()
  const extraTitleMap = new Map<string, string>()
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

  if (params.extraOutboundRefs) {
    for (const ref of params.extraOutboundRefs) {
      if (ref.documentId === params.documentId) continue
      outboundTargets.add(ref.documentId)
      if (ref.anchorText) {
        extraTitleMap.set(ref.documentId, ref.anchorText)
      }
    }
  }

  const overlap = new Set<string>([...outboundTargets].filter(documentId => inboundSources.has(documentId)))

  const outbound = buildAssociationList({
    documentIds: outboundTargets,
    documentMap: params.documentMap,
    overlap,
    direction: 'outbound',
    includeMissing: true,
    extraTitleMap,
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
  extraTitleMap?: Map<string, string>
}): LinkAssociationItem[] {
  return [...params.documentIds]
    .map((documentId) => {
      const document = params.documentMap.get(documentId)
      if (!document) {
        if (params.includeMissing) {
          const title = params.extraTitleMap?.get(documentId) || documentId
          return {
            documentId,
            title,
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
