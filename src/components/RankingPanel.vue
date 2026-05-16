<template>
  <component :is="variant === 'panel' ? 'section' : 'div'" :class="variant === 'panel' ? 'panel panel--primary' : 'ranking-detail'">
    <div v-if="variant === 'panel'" class="panel-header">
      <div class="panel-header__main">
        <h2 class="panel-header__title">{{ t('rankingPanel.title') }}</h2>
        <div class="panel-header__actions">
        <button
          class="ghost-button ghost-button--filled"
          type="button"
          @click="emit('openActiveChat')"
        >
          {{ t('wikiChat.activeDocChat') }}
        </button>
        <span class="meta-text">{{ t('rankingPanel.docsCount', { count: panelCount }) }}</span>
        <span class="meta-text">{{ t('rankingPanel.lastRefreshed', { value: snapshotLabel }) }}</span>
        <button
          class="panel-toggle"
          type="button"
          :aria-expanded="isExpanded"
          :aria-label="isExpanded ? t('rankingPanel.collapseDetails') : t('rankingPanel.expandDetails')"
          @click="onTogglePanel"
        >
          {{ isExpanded ? t('rankingPanel.collapse') : t('rankingPanel.expand') }}
          <span
            class="panel-toggle__caret"
            aria-hidden="true"
          />
          </button>
        </div>
      </div>
      <p class="panel-header__description">{{ t('rankingPanel.description') }}</p>
    </div>

    <div
      v-show="variant === 'detail' || isExpanded"
      class="panel-body"
    >
      <div
        v-if="ranking.length"
        class="ranking-list"
      >
        <div
          v-for="item in ranking.slice(0, 12)"
          :key="item.documentId"
          class="ranking-entry"
        >
          <article :class="['ranking-item', { 'ranking-item--collapsed': props.collapsedItems[item.documentId] }]">
            <div class="ranking-item__title-row">
              <DocumentTitle
                :document-id="item.documentId"
                :title="resolveTitle(item.documentId)"
                :open-document="openDocument"
                :is-theme-document="item.isThemeDocument"
              />
              <button
                v-if="props.onToggleItemCollapse"
                class="ranking-item__collapse-toggle"
                type="button"
                :aria-expanded="!props.collapsedItems[item.documentId]"
                @click="props.onToggleItemCollapse(item.documentId)"
              >
                <span
                  class="ranking-item__caret"
                  aria-hidden="true"
                />
              </button>
            </div>
            <div v-show="!props.collapsedItems[item.documentId]">
            <div class="ranking-item__meta">
              <span>{{ t('rankingPanel.connectionSummary', { inbound: item.inboundReferences, sources: item.distinctSourceDocuments, outbound: item.outboundReferences, children: item.childDocumentCount }) }}</span>
            </div>
            <div class="ranking-item__timestamps">
              <span>{{ t('rankingPanel.created') }}: {{ formatTimestamp(item.createdAt) }}</span>
              <span>{{ t('rankingPanel.updated') }}: {{ formatTimestamp(item.updatedAt) }}</span>
            </div>
            <div class="ranking-item__actions">
              <button
                class="ghost-button ghost-button--filled"
              type="button"
              @click="handleToggleLinkPanel(item.documentId)"
            >
                {{ isLinkPanelExpanded(item.documentId) ? t('rankingPanel.hideRelated') : t('rankingPanel.viewRelated') }}
              </button>
            </div>
            <div
              v-if="isLinkPanelExpanded(item.documentId)"
              class="link-association"
            >
              <div class="link-association__group">
                <button
                  :class="['link-association__toggle', { 'link-association__toggle--expanded': isLinkGroupExpanded(item.documentId, 'outbound') }]"
                  type="button"
                  :aria-expanded="isLinkGroupExpanded(item.documentId, 'outbound')"
                  @click="toggleLinkGroup(item.documentId, 'outbound')"
                >
                  <span class="link-association__caret" aria-hidden="true" />
                  {{ t('rankingPanel.outbound') }} {{ resolveAssociations(item.documentId).outbound.length }}
                </button>
                <div
                  v-show="isLinkGroupExpanded(item.documentId, 'outbound')"
                  class="link-association__list"
                >
                  <div
                    v-for="link in resolveAssociations(item.documentId).outbound"
                    :key="`outbound-${item.documentId}-${link.documentId}`"
                    class="link-association__item"
                  >
                    <button
                      class="link-association__doc"
                      :class="{ 'link-association__doc--highlight': !link.isOverlap }"
                      type="button"
                      @click="openDocument(link.documentId)"
                    >
                      {{ link.title }}
                    </button>
                    <button
                      v-if="!link.isOverlap"
                      class="ghost-button"
                      type="button"
                      :disabled="isSyncing(item.documentId, link.documentId, 'outbound')"
                      @click="syncAssociation(item.documentId, link.documentId, 'outbound')"
                    >
                      {{ isSyncing(item.documentId, link.documentId, 'outbound') ? t('rankingPanel.syncing') : t('rankingPanel.sync') }}
                    </button>
                  </div>
                  <p
                    v-if="resolveAssociations(item.documentId).outbound.length === 0"
                    class="empty-inline"
                  >
                    {{ t('rankingPanel.noOutbound') }}
                  </p>
                </div>
              </div>
              <div class="link-association__group">
                <button
                  :class="['link-association__toggle', { 'link-association__toggle--expanded': isLinkGroupExpanded(item.documentId, 'inbound') }]"
                  type="button"
                  :aria-expanded="isLinkGroupExpanded(item.documentId, 'inbound')"
                  @click="toggleLinkGroup(item.documentId, 'inbound')"
                >
                  <span class="link-association__caret" aria-hidden="true" />
                  {{ t('rankingPanel.inbound') }} {{ resolveAssociations(item.documentId).inbound.length }}
                </button>
                <div
                  v-show="isLinkGroupExpanded(item.documentId, 'inbound')"
                  class="link-association__list"
                >
                  <div
                    v-for="link in resolveAssociations(item.documentId).inbound"
                    :key="`inbound-${item.documentId}-${link.documentId}`"
                    class="link-association__item"
                  >
                    <button
                      class="link-association__doc"
                      :class="{ 'link-association__doc--highlight': !link.isOverlap }"
                      type="button"
                      @click="openDocument(link.documentId)"
                    >
                      {{ link.title }}
                    </button>
                    <button
                      v-if="!link.isOverlap"
                      class="ghost-button"
                      type="button"
                      :disabled="isSyncing(item.documentId, link.documentId, 'inbound')"
                      @click="syncAssociation(item.documentId, link.documentId, 'inbound')"
                    >
                      {{ isSyncing(item.documentId, link.documentId, 'inbound') ? t('rankingPanel.syncing') : t('rankingPanel.sync') }}
                    </button>
                  </div>
                  <p
                    v-if="resolveAssociations(item.documentId).inbound.length === 0"
                    class="empty-inline"
                  >
                    {{ t('rankingPanel.noInbound') }}
                  </p>
                </div>
              </div>
              <div class="link-association__group">
                <button
                  :class="['link-association__toggle', { 'link-association__toggle--expanded': isLinkGroupExpanded(item.documentId, 'child') }]"
                  type="button"
                  :aria-expanded="isLinkGroupExpanded(item.documentId, 'child')"
                  @click="toggleLinkGroup(item.documentId, 'child')"
                >
                  <span class="link-association__caret" aria-hidden="true" />
                  {{ t('rankingPanel.childDocsDeduped') }} {{ resolveAssociations(item.documentId).childDocuments.length }}
                </button>
                <div
                  v-show="isLinkGroupExpanded(item.documentId, 'child')"
                  class="link-association__list"
                >
                  <div
                    v-for="link in resolveAssociations(item.documentId).childDocuments"
                    :key="`child-${item.documentId}-${link.documentId}`"
                    class="link-association__item"
                  >
                    <button
                      class="link-association__doc"
                      :class="{ 'link-association__doc--highlight': true }"
                      type="button"
                      @click="openDocument(link.documentId)"
                    >
                      {{ link.title }}
                    </button>
                    <button
                      class="ghost-button"
                      type="button"
                      :disabled="isSyncing(item.documentId, link.documentId, 'child')"
                      @click="syncAssociation(item.documentId, link.documentId, 'child')"
                    >
                      {{ isSyncing(item.documentId, link.documentId, 'child') ? t('rankingPanel.linking') : t('rankingPanel.link') }}
                    </button>
                  </div>
                  <p
                    v-if="resolveAssociations(item.documentId).childDocuments.length === 0"
                    class="empty-inline"
                  >
                    {{ t('rankingPanel.noChildLinks') }}
                  </p>
                </div>
              </div>
            </div>
            <SuggestionCallout :suggestions="item.suggestions ?? []" />
            <div
              v-if="showWikiPanelActions && item.isThemeDocument"
              class="ranking-item__wiki"
            >
              <div class="ranking-item__wiki-actions">
                <button
                  class="action-button"
                  type="button"
                  @click="toggleCoreDocumentWikiPanel(item.documentId)"
                >
                  {{ isWikiPanelVisibleForCoreDocument(item.documentId) ? t('rankingPanel.hideWiki') : t('rankingPanel.maintainWiki') }}
                </button>
                <button
                  v-if="$props.onSaveThemePrompt"
                  class="ghost-button ghost-button--filled ranking-item__edit-prompt-btn"
                  type="button"
                  :title="t('rankingPanel.themeEditPrompt')"
                  @click="openThemePromptDialog(item.documentId)"
                >
                  <svg class="ranking-item__edit-prompt-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h1.5L17.5 8 16 6.5 4 19V20zm-2 2v-4L17.5 2.5l4 4L6 20H2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
              <WikiMaintainPanel
                v-if="isWikiPanelVisibleForCoreDocument(item.documentId)"
                v-bind="wikiPanelProps"
                :open-source-document="wikiPanelProps.openSourceDocument ?? (() => {})"
                @update:incremental-enabled="(v: boolean) => emit('update:incrementalEnabled', v)"
                @toggle-theme-link="(docId: string, themeId: string) => emit('toggleThemeLink', docId, themeId)"
                @add-tag="(id: string) => emit('addTag', id)"
              />
            </div>
            </div>
          </article>
        </div>
      </div>
      <div
        v-else
        class="empty-state"
      >
        {{ t('rankingPanel.empty') }}
      </div>
    </div>

    <div v-if="themePromptDialogVisible" class="theme-prompt-overlay" @click.self="closeThemePromptDialog">
      <div class="theme-prompt-dialog">
        <h3 class="theme-prompt-dialog__title">{{ t('rankingPanel.themePromptDialogTitle') }}</h3>
        <p class="theme-prompt-dialog__subtitle">{{ themePromptDialogDocumentTitle }}</p>
        <textarea
          v-model="themePromptEditText"
          class="theme-prompt-dialog__textarea"
          rows="8"
        />
        <div class="theme-prompt-dialog__reference">
          <strong>{{ t('rankingPanel.themePromptDialogReference') }}</strong>
          <pre class="theme-prompt-dialog__reference-text">{{ themePromptReferenceText }}</pre>
        </div>
        <div class="theme-prompt-dialog__actions">
          <button class="action-button" type="button" @click="saveThemePrompt">
            {{ t('rankingPanel.themePromptDialogSave') }}
          </button>
          <button class="ghost-button" type="button" @click="clearThemePrompt">
            {{ t('rankingPanel.themePromptDialogClear') }}
          </button>
          <button class="ghost-button" type="button" @click="closeThemePromptDialog">
            {{ t('llmWiki.maintain.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import type { RankingDetailItem } from '@/analytics/summary-details'
import type { LinkAssociations, ExtractedDocRef } from '@/analytics/link-associations'
import { fetchOutboundBlockRefDocRefs, fetchKramdownOutboundDocRefs } from '@/analytics/link-associations'
import type { LinkDirection } from '@/analytics/link-sync'
import type { WikiPreviewState } from '@/composables/use-analytics'
import { ref } from 'vue'
import { t } from '@/i18n/ui'
import { DEFAULT_WIKI_TEMPLATE_PROMPTS } from '@/types/config'
import DocumentTitle from './DocumentTitle.vue'
import SuggestionCallout from './SuggestionCallout.vue'
import WikiMaintainPanel from './WikiMaintainPanel.vue'

const props = withDefaults(defineProps<{
  ranking: RankingDetailItem[]
  panelCount: number
  snapshotLabel: string
  isExpanded: boolean
  onTogglePanel: () => void
  resolveTitle: (documentId: string) => string
  formatTimestamp: (timestamp?: string) => string
  openDocument: (documentId: string) => void
  toggleLinkPanel: (documentId: string) => void
  isLinkPanelExpanded: (documentId: string) => boolean
  resolveLinkAssociations: (documentId: string, extraOutboundRefs?: ExtractedDocRef[]) => LinkAssociations
  toggleLinkGroup: (documentId: string, direction: LinkDirection) => void
  isLinkGroupExpanded: (documentId: string, direction: LinkDirection) => boolean
  isSyncing: (coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) => boolean
  syncAssociation: (coreDocumentId: string, targetDocumentId: string, direction: LinkDirection) => void
  wikiPanelProps: {
    wikiEnabled: boolean
    aiEnabled: boolean
    aiConfigReady: boolean
    previewLoading: boolean
    applyLoading: boolean
    error: string
    progressText: string
    preview: WikiPreviewState | null
    prepareWikiPreview: () => void | Promise<void>
    applyWikiChanges: (overwriteConflicts?: boolean) => void | Promise<void>
    openWikiDocument: (documentId: string) => void
    formatTimestamp: (timestamp?: string) => string
    formatWikiPreviewTimestamp: (timestamp?: string) => { dateText: string, timeText: string, fullText: string }
    incrementalEnabled?: boolean
    openSourceDocument?: (documentId: string) => void
    onUpdateIncrementalEnabled?: (value: boolean) => void
    onToggleThemeLink?: (documentId: string, themeDocumentId: string) => void
    onAddTag?: (documentId: string) => void
    isThemeSuggestionActive?: (documentId: string, themeDocumentId: string) => boolean
  }
  isWikiPanelVisibleForCoreDocument: (documentId: string) => boolean
  toggleCoreDocumentWikiPanel: (documentId: string) => void | Promise<void>
  showWikiPanelActions?: boolean
  variant?: 'panel' | 'detail'
  collapsedItems?: Record<string, boolean>
  onToggleItemCollapse?: (documentId: string) => void
  getBlockKramdown?: (id: string) => Promise<{ id: string; kramdown: string }>
  onSaveThemePrompt?: (documentId: string, prompt: string | undefined) => Promise<void>
  onGetThemePrompt?: (documentId: string) => Promise<string | undefined>
  wikiTemplatePrompts?: Record<string, string>
}>(), {
  showWikiPanelActions: true,
  variant: 'panel',
  collapsedItems: () => ({}),
  onToggleItemCollapse: undefined,
})

const emit = defineEmits<{
  (e: 'update:incrementalEnabled', value: boolean): void
  (e: 'toggleThemeLink', documentId: string, themeDocumentId: string): void
  (e: 'addTag', documentId: string, tag?: string): void
  (e: 'openActiveChat'): void
}>()

const extraOutboundRefsMap = ref<Record<string, ExtractedDocRef[]>>({})

const themePromptDialogVisible = ref(false)
const themePromptDialogDocumentId = ref('')
const themePromptDialogDocumentTitle = ref('')
const themePromptEditText = ref('')
const themePromptReferenceText = ref('')

async function openThemePromptDialog(documentId: string) {
  const item = props.ranking.find(r => r.documentId === documentId)
  if (!item) return
  themePromptDialogDocumentId.value = documentId
  themePromptDialogDocumentTitle.value = props.resolveTitle(documentId)
  themePromptEditText.value = ''
  themePromptReferenceText.value = ''
  themePromptDialogVisible.value = true

  if (props.onGetThemePrompt) {
    try {
      const existing = await props.onGetThemePrompt(documentId)
      if (existing) {
        themePromptEditText.value = existing
      }
    } catch {
      // ignore
    }
  }

  const userOverride = props.wikiTemplatePrompts
  const templateTypes = ['tech_topic', 'product_howto', 'social_topic', 'media_list'] as const
  const lines: string[] = []
  for (const tt of templateTypes) {
    const prompt = userOverride?.[tt]?.trim() || DEFAULT_WIKI_TEMPLATE_PROMPTS[tt]?.trim()
    if (prompt) {
      lines.push(`[${tt}]`, prompt.slice(0, 200) + (prompt.length > 200 ? '...' : ''), '')
    }
  }
  themePromptReferenceText.value = lines.join('\n')
}

function closeThemePromptDialog() {
  themePromptDialogVisible.value = false
}

async function saveThemePrompt() {
  if (props.onSaveThemePrompt) {
    const text = themePromptEditText.value.trim()
    await props.onSaveThemePrompt(themePromptDialogDocumentId.value, text || undefined)
  }
  closeThemePromptDialog()
}

async function clearThemePrompt() {
  if (props.onSaveThemePrompt) {
    await props.onSaveThemePrompt(themePromptDialogDocumentId.value, undefined)
  }
  themePromptEditText.value = ''
  closeThemePromptDialog()
}

async function handleToggleLinkPanel(documentId: string) {
  props.toggleLinkPanel(documentId)
  if (!props.isLinkPanelExpanded(documentId)) {
    const next = { ...extraOutboundRefsMap.value }
    delete next[documentId]
    extraOutboundRefsMap.value = next
    return
  }
  if (documentId in extraOutboundRefsMap.value) return

  const merged = new Map<string, ExtractedDocRef>()

  try {
    const refs = await fetchOutboundBlockRefDocRefs(documentId)
    for (const ref of refs) {
      merged.set(ref.documentId, ref)
    }
  } catch {
    // SQL failed, continue with kramdown fallback
  }

  if (props.getBlockKramdown) {
    try {
      const { kramdown } = await props.getBlockKramdown(documentId)
      const kramdownRefs = await fetchKramdownOutboundDocRefs(kramdown)
      for (const ref of kramdownRefs) {
        const existing = merged.get(ref.documentId)
        if (!existing) {
          merged.set(ref.documentId, ref)
        } else if (!existing.anchorText && ref.anchorText) {
          existing.anchorText = ref.anchorText
        }
      }
    } catch {
      // kramdown failed
    }
  }

  extraOutboundRefsMap.value = { ...extraOutboundRefsMap.value, [documentId]: [...merged.values()] }
}

function resolveAssociations(documentId: string): LinkAssociations {
  const extraOutboundRefs = extraOutboundRefsMap.value[documentId]
  const associations = props.resolveLinkAssociations(documentId, extraOutboundRefs)
  return {
    outbound: associations.outbound ?? [],
    inbound: associations.inbound ?? [],
    childDocuments: associations.childDocuments ?? [],
  }
}
</script>

<style scoped>
.panel {
  border-radius: 16px;
  border: 1px solid var(--panel-border);
  background: var(--surface-card-strong);
  box-shadow: 0 6px 16px -8px rgba(0, 0, 0, 0.08);
  padding: var(--panel-padding, 24px);
}

.panel--primary {
  grid-column: span 1;
}

.ranking-detail {
  display: block;
}

.panel-header {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.panel-header__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-header__title {
  font-size: var(--text-lg, 16px);
  font-weight: 600;
  margin: 0;
}

.panel-header p,
.meta-text,
.empty-inline,
.ranking-item__meta,
.ranking-item__timestamps {
  color: var(--panel-muted);
  font-size: 13px;
}

.panel-header__actions {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.meta-text {
  font-size: 12px;
  white-space: nowrap;
}

.panel-toggle {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--surface-card-soft);
  color: var(--b3-theme-on-background);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s, color 0.2s;
}

.panel-toggle:hover {
  background: var(--surface-card);
}

.panel-toggle__caret {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.panel-toggle[aria-expanded='false'] .panel-toggle__caret {
  transform: rotate(-45deg);
}

.ranking-list {
  display: grid;
  gap: 12px;
}

.ranking-entry {
  display: grid;
  gap: 8px;
}

.ranking-item {
  padding: 16px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--panel-border);
  transition: background-color 0.2s;
  display: grid;
  gap: 8px;
}

.ranking-item:hover {
  background: var(--surface-card-soft);
}

.ranking-item--collapsed {
  padding-top: 10px;
  padding-bottom: 10px;
}

.ranking-item__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ranking-item__collapse-toggle {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.ranking-item__collapse-toggle:hover {
  background: var(--surface-card-soft);
}

.ranking-item__caret {
  width: 6px;
  height: 6px;
  border-right: 1.5px solid var(--panel-muted);
  border-bottom: 1.5px solid var(--panel-muted);
  transform: rotate(45deg);
  transition: transform 0.2s ease;
}

.ranking-item__collapse-toggle[aria-expanded='false'] .ranking-item__caret {
  transform: rotate(-45deg);
}

.ranking-item__meta,
.ranking-item__timestamps {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ranking-item__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  margin-top: 4px;
}

.ranking-item__actions .ghost-button {
  flex: 1;
}

.ranking-item__wiki {
  display: grid;
  gap: 12px;
  margin-top: 8px;
}

.ranking-item__wiki-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.ranking-item__edit-prompt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 8px;
}

.ranking-item__edit-prompt-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.theme-prompt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.theme-prompt-dialog {
  background: var(--b3-theme-background);
  border-radius: 12px;
  border: 1px solid var(--panel-border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 24px;
  width: min(560px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  display: grid;
  gap: 16px;
}

.theme-prompt-dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.theme-prompt-dialog__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--panel-muted);
}

.theme-prompt-dialog__textarea {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--b3-theme-on-background);
  padding: 10px 12px;
  box-sizing: border-box;
  font: inherit;
  font-size: 13px;
  resize: vertical;
  line-height: 1.5;
}

.theme-prompt-dialog__reference {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--panel-muted);
}

.theme-prompt-dialog__reference strong {
  font-weight: 500;
  font-size: 13px;
  color: color-mix(in srgb, var(--b3-theme-on-background) 70%, transparent);
}

.theme-prompt-dialog__reference-text {
  margin: 0;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--b3-theme-surface) 60%, transparent);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.theme-prompt-dialog__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ranking-item__timestamps {
  row-gap: 4px;
}

.action-button {
  border: 0;
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, background-color 0.2s;
  font-weight: 500;
  min-width: 108px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--b3-theme-primary) 30%, transparent);
}

.action-button:hover:not(:disabled) {
  opacity: 0.9;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: progress;
  box-shadow: none;
}

.ghost-button {
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.ghost-button:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 15%, transparent);
}

.ghost-button--filled {
  background: color-mix(in srgb, var(--b3-theme-primary) 9%, var(--surface-card));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 50%, transparent);
}

.ghost-button--filled:hover {
  background: color-mix(in srgb, var(--b3-theme-primary) 16%, var(--surface-card));
}

.ghost-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.empty-state {
  padding: var(--panel-padding, 24px);
  text-align: center;
  color: var(--panel-muted);
  background: var(--surface-card);
  border-radius: 12px;
  border: 1px dashed var(--panel-border);
}

.link-association {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed var(--panel-border);
  background: var(--surface-card-soft);
  display: grid;
  gap: 12px;
}

.link-association__toggle {
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.link-association__toggle--expanded {
  color: color-mix(in srgb, var(--accent-cool) 75%, var(--b3-theme-on-background));
}

.link-association__caret {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.2s ease;
}

.link-association__toggle--expanded .link-association__caret {
  transform: rotate(45deg);
}

.link-association__list {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.link-association__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.link-association__doc {
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  color: var(--b3-theme-primary);
  cursor: pointer;
  text-align: left;
}

.link-association__doc:hover {
  color: color-mix(in srgb, var(--b3-theme-primary) 70%, transparent);
}

.link-association__doc--highlight {
  color: color-mix(in srgb, var(--accent-warm) 75%, var(--b3-theme-on-background));
  font-weight: 600;
}

.link-association__doc--highlight:hover {
  color: color-mix(in srgb, var(--accent-warm) 60%, var(--b3-theme-on-background));
}
</style>
