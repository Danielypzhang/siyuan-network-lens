import { computed, ref } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { WikiChatScope, WikiIndexPage } from '@/analytics/wiki-index'
import {
  buildRouteSystemPrompt,
  buildRouteUserPrompt,
  buildChatSystemPrompt,
  buildWikiContextMessage,
  buildActiveDocChatSystemPrompt,
  buildActiveDocChatUserPrompt,
  parseRouteResponse,
  parseChatResponse,
} from '@/analytics/llm-wiki-chat-service'
import { t } from '@/i18n/ui'
import type { PluginLogger } from '@/utils/plugin-logger'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  sourcePage?: WikiIndexPage
  referencedDocumentIds?: string[]
  isRouting?: boolean
  sourceSwitched?: boolean
  switchFrom?: string
  switchTo?: string
}

export interface WikiChatSession {
  messages: ChatMessage[]
  currentSourcePage: WikiIndexPage | null
  isRouting: boolean
  isLoading: boolean
  error: string | null
}

export interface WikiChatSessionOptions {
  scope: Ref<WikiChatScope>
  wikiPages: Ref<WikiIndexPage[]>
  forwardProxy: (url: string, method?: string, payload?: any, headers?: any[], timeout?: number, contentType?: string) => Promise<any>
  getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
  config: Ref<{
    aiBaseUrl: string
    aiApiKey: string
    aiModel: string
    aiRequestTimeoutSeconds: number
    aiMaxTokens: number
    aiTemperature: number
    aiMaxContextMessages?: number
  }>
  logger?: PluginLogger
}

export interface WikiChatSessionController {
  session: Ref<WikiChatSession>
  inputText: Ref<string>
  mentionPopupVisible: Ref<boolean>
  mentionFilter: Ref<string>
  filteredPages: ComputedRef<WikiIndexPage[]>
  syncMentionState: (cursorPos: number) => void
  sendMessage: () => Promise<void>
  switchSource: (page: WikiIndexPage) => void
  switchToActiveDoc: (activeContent: WikiChatScope['activeContent']) => void
  resetSession: () => void
  buildSaveMarkdown: () => string
  appendChatToWiki: (params: {
    wikiStore: { getPageRecord: (pageKey: string) => Promise<{ pageId?: string, sourceDocumentIds?: string[] } | null> }
    getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
    updateBlock: (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
  }) => Promise<boolean>
}

let messageIdCounter = 0
function nextMessageId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`
}

export function createWikiChatSession(options: WikiChatSessionOptions): WikiChatSessionController {
  const { scope, wikiPages, forwardProxy, getBlockKramdown, config, logger } = options

  const initialSourcePage = scope.value.mode === 'document' ? scope.value.targetPage ?? null : null

  const session = ref<WikiChatSession>({
    messages: [],
    currentSourcePage: initialSourcePage,
    isRouting: false,
    isLoading: false,
    error: null,
  })

  const inputText = ref('')
  const mentionPopupVisible = ref(false)
  const mentionFilter = ref('')

  const filteredPages = computed(() => {
    const filter = mentionFilter.value.toLowerCase()
    return wikiPages.value.filter(page => page.title.toLowerCase().includes(filter))
  })

  function syncMentionState(cursorPos: number) {
    const beforeCursor = inputText.value.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@([^@\s]*)$/)

    if (!atMatch) {
      mentionFilter.value = ''
      mentionPopupVisible.value = false
      return
    }

    mentionFilter.value = atMatch[1]
    mentionPopupVisible.value = filteredPages.value.length > 0
  }

  function switchSource(page: WikiIndexPage) {
    const oldTitle = session.value.currentSourcePage?.title ?? ''
    inputText.value = inputText.value.replace(/@[^@\s]*\s?/, '')
    mentionPopupVisible.value = false
    mentionFilter.value = ''
    session.value.currentSourcePage = page
    session.value.messages.push({
      id: nextMessageId(),
      role: 'system',
      content: t('llmWiki.chat.sourceSwitched', { from: oldTitle, to: page.title }),
      timestamp: Date.now(),
      sourceSwitched: true,
      switchFrom: oldTitle,
      switchTo: page.title,
    })
  }

  function switchToActiveDoc(activeContent: WikiChatScope['activeContent']) {
    if (!activeContent) return
    const oldTitle = session.value.currentSourcePage?.title ?? ''
    inputText.value = inputText.value.replace(/@[^@\s]*\s?/, '')
    mentionPopupVisible.value = false
    mentionFilter.value = ''
    scope.value = {
      mode: 'active',
      activeContent,
    }
    session.value.currentSourcePage = null
    session.value.messages.push({
      id: nextMessageId(),
      role: 'system',
      content: t('llmWiki.chat.sourceSwitched', { from: oldTitle, to: activeContent.title }),
      timestamp: Date.now(),
      sourceSwitched: true,
      switchFrom: oldTitle,
      switchTo: activeContent.title,
    })
  }

  async function sendMessage(): Promise<void> {
    const text = inputText.value.trim()
    if (!text || session.value.isLoading) return

    const isActiveMode = scope.value.mode === 'active' && !!scope.value.activeContent

    if (!isActiveMode) {
      const atMatch = text.match(/@([^\s@]+)/)
      if (atMatch) {
        const mentionText = atMatch[1]
        const matchedPage = wikiPages.value.find(
          p => p.title.toLowerCase().includes(mentionText.toLowerCase()),
        )
        if (matchedPage) {
          switchSource(matchedPage)
        }
      }
    }

    const cleanText = inputText.value.replace(/@[^\s@]+\s?/, '').trim()
    if (!cleanText) return

    // 2. Push user message
    session.value.messages.push({
      id: nextMessageId(),
      role: 'user',
      content: cleanText,
      timestamp: Date.now(),
    })
    inputText.value = ''
    session.value.error = null

    const currentSource = session.value.currentSourcePage
    logger?.log('[WikiChat] sendMessage', {
      message: cleanText.slice(0, 100),
      currentSource: currentSource?.title ?? null,
      needRouting: !currentSource,
    })

    try {
      if (scope.value.mode === 'active' && scope.value.activeContent) {
        const activeCtx = scope.value.activeContent

        const maxContext = config.value.aiMaxContextMessages ?? 1
        const recentHistory = session.value.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-(maxContext * 2))

        const contextMessages = [
          { role: 'system' as const, content: buildActiveDocChatSystemPrompt() },
          ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: buildActiveDocChatUserPrompt({
            documentTitle: activeCtx.title,
            documentContent: activeCtx.content,
            question: cleanText,
          }) },
        ]

        session.value.isLoading = true
        const endpoint = `${config.value.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
        logger?.log('[WikiChat] active doc chat: calling AI', {
          endpoint,
          model: config.value.aiModel,
          messageCount: contextMessages.length,
          documentId: activeCtx.documentId,
        })
        const response = await forwardProxy(
          endpoint,
          'POST',
          JSON.stringify({
            model: config.value.aiModel,
            messages: contextMessages,
            max_tokens: config.value.aiMaxTokens,
            temperature: config.value.aiTemperature,
          }),
          [
            { Authorization: `Bearer ${config.value.aiApiKey}` },
            { Accept: 'application/json' },
          ],
          config.value.aiRequestTimeoutSeconds * 1000,
          'application/json',
        )
        const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
        const aiContent = body.choices?.[0]?.message?.content ?? ''
        logger?.log('[WikiChat] active doc chat: AI content', { content: aiContent.slice(0, 200) })

        const parsed = parseChatResponse(aiContent)
        logger?.log('[WikiChat] active doc chat: parsed answer', {
          answer: parsed.answer.slice(0, 100),
          refCount: parsed.referencedDocumentIds.length,
        })
        session.value.messages.push({
          id: nextMessageId(),
          role: 'assistant',
          content: parsed.answer,
          timestamp: Date.now(),
          referencedDocumentIds: parsed.referencedDocumentIds,
        })
      } else {
        // 3. Route if needed (first message in topic mode)
      if (!session.value.currentSourcePage) {
        const routingMsgId = nextMessageId()
        session.value.messages.push({
          id: routingMsgId,
          role: 'system',
          content: t('llmWiki.chat.autoMatching'),
          timestamp: Date.now(),
          isRouting: true,
        })
        session.value.isRouting = true

        const pageTitles = wikiPages.value.map(p => p.title)
        const pageSummaries = wikiPages.value.map(p => p.summary ?? '')
        logger?.log('[WikiChat] routing: calling AI', { question: cleanText, pageTitles, summaries: pageSummaries.map(s => s.slice(0, 80)) })
        const routeResponse = await callAiEndpoint(
          buildRouteSystemPrompt(),
          buildRouteUserPrompt({ question: cleanText, pageTitles, pageSummaries }),
        )
        logger?.log('[WikiChat] routing: AI returned', { raw: routeResponse.slice(0, 200) })
        const matchedTitle = parseRouteResponse(routeResponse)
        const normalizedMatch = matchedTitle.toLowerCase().trim()
        let targetPage = wikiPages.value.find(
          p => p.title.toLowerCase().trim() === normalizedMatch,
        )
        if (!targetPage) {
          targetPage = wikiPages.value.find(
            p => p.title.toLowerCase().includes(normalizedMatch)
              || normalizedMatch.includes(p.title.toLowerCase()),
          )
        }
        if (!targetPage) {
          targetPage = wikiPages.value[0]
        }

        session.value.currentSourcePage = targetPage ?? null
        session.value.isRouting = false
        logger?.log('[WikiChat] routing: matched page', { title: targetPage?.title ?? 'none' })

        // Update routing message to confirmed
        const routingMsg = session.value.messages.find(m => m.id === routingMsgId)
        if (routingMsg && targetPage) {
          routingMsg.content = t('llmWiki.chat.sourceConfirmed', { title: targetPage.title })
          routingMsg.isRouting = false
        }
      }

      if (!session.value.currentSourcePage) {
        session.value.error = t('llmWiki.chat.noWikiPages')
        return
      }

      // 4. Fetch wiki page content
      const wikiBlock = await getBlockKramdown(session.value.currentSourcePage.documentId)
      logger?.log('[WikiChat] wiki content fetched', {
        docId: session.value.currentSourcePage.documentId,
        kramdownLength: wikiBlock.kramdown?.length ?? 0,
      })

      // 5. Build context messages
      const maxContext = config.value.aiMaxContextMessages ?? 1
      const recentHistory = session.value.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-(maxContext * 2))

      const contextMessages = [
        { role: 'system' as const, content: buildChatSystemPrompt() },
        { role: 'system' as const, content: buildWikiContextMessage({
          wikiPageTitle: session.value.currentSourcePage.title,
          wikiPageMarkdown: wikiBlock.kramdown,
        }) },
        ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: cleanText },
      ]

      // 6. Call AI
      session.value.isLoading = true
      const endpoint = `${config.value.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
      logger?.log('[WikiChat] chat: calling AI', {
        endpoint,
        model: config.value.aiModel,
        messageCount: contextMessages.length,
      })
      const response = await forwardProxy(
        endpoint,
        'POST',
        JSON.stringify({
          model: config.value.aiModel,
          messages: contextMessages,
          max_tokens: config.value.aiMaxTokens,
          temperature: config.value.aiTemperature,
        }),
        [
          { Authorization: `Bearer ${config.value.aiApiKey}` },
          { Accept: 'application/json' },
        ],
        config.value.aiRequestTimeoutSeconds * 1000,
        'application/json',
      )
      logger?.log('[WikiChat] chat: response received', {
        bodyType: typeof response?.body,
        bodyPreview: typeof response?.body === 'string'
          ? response.body.slice(0, 200)
          : JSON.stringify(response?.body).slice(0, 200),
      })
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
      const aiContent = body.choices?.[0]?.message?.content ?? ''
      logger?.log('[WikiChat] chat: AI content', { content: aiContent.slice(0, 200) })

      // 7. Parse and push assistant message
      const parsed = parseChatResponse(aiContent)
      logger?.log('[WikiChat] chat: parsed answer', {
        answer: parsed.answer.slice(0, 100),
        refCount: parsed.referencedDocumentIds.length,
      })
      session.value.messages.push({
        id: nextMessageId(),
        role: 'assistant',
        content: parsed.answer,
        timestamp: Date.now(),
        sourcePage: session.value.currentSourcePage,
        referencedDocumentIds: parsed.referencedDocumentIds,
      })
      }
    } catch (e: any) {
      logger?.error('[WikiChat] sendMessage error:', e.message ?? String(e))
      session.value.error = e.message ?? String(e)
    } finally {
      session.value.isLoading = false
    }
  }

  async function callAiEndpoint(systemPrompt: string, userPrompt: string): Promise<string> {
    const endpoint = `${config.value.aiBaseUrl.replace(/\/+$/, '')}/chat/completions`
    logger?.log('[WikiChat] callAiEndpoint', { url: endpoint, model: config.value.aiModel })
    const response = await forwardProxy(
      endpoint,
      'POST',
      JSON.stringify({
        model: config.value.aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.value.aiMaxTokens,
        temperature: config.value.aiTemperature,
      }),
      [
        { Authorization: `Bearer ${config.value.aiApiKey}` },
        { Accept: 'application/json' },
      ],
      config.value.aiRequestTimeoutSeconds * 1000,
      'application/json',
    )
    logger?.log('[WikiChat] callAiEndpoint response', {
      bodyType: typeof response?.body,
      bodyPreview: typeof response?.body === 'string'
        ? response.body.slice(0, 200)
        : JSON.stringify(response?.body).slice(0, 200),
    })
    const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body
    if (body.error) {
      const errMsg = body.error.message ?? JSON.stringify(body.error)
      logger?.error('[WikiChat] callAiEndpoint API error:', errMsg)
      throw new Error(`AI API Error: ${errMsg}`)
    }
    const content = body.choices?.[0]?.message?.content ?? ''
    logger?.log('[WikiChat] callAiEndpoint content', { content: content.slice(0, 200) })
    return content
  }

  function resetSession() {
    const initialSourcePage = scope.value.mode === 'document'
      ? scope.value.targetPage ?? null
      : null
    session.value = {
      messages: [],
      currentSourcePage: initialSourcePage,
      isRouting: false,
      isLoading: false,
      error: null,
    }
    inputText.value = ''
    mentionPopupVisible.value = false
    mentionFilter.value = ''
  }

  function buildSaveMarkdown(): string {
    const msgs = session.value.messages
    const userMsgs = msgs.filter(m => m.role === 'user')
    if (userMsgs.length === 0) return ''

    const initialSource = session.value.currentSourcePage?.title ?? ''
    const now = new Date().toLocaleString()
    const lines: string[] = [
      `# ${t('llmWiki.chat.chatTitle')}`,
      `> ${t('llmWiki.chat.sourceLabel')}: ${initialSource}`,
      `> ${now}`,
      '',
      '---',
    ]

    let qIndex = 0
    for (const msg of msgs) {
      if (msg.role === 'user') {
        qIndex++
        lines.push('')
        lines.push(`## Q${qIndex}: ${msg.content}`)
      } else if (msg.role === 'assistant') {
        if (msg.sourcePage) {
          lines.push('')
          lines.push(`> 📄 ${t('llmWiki.chat.sourceLabel')}: [${msg.sourcePage.title}](siyuan://blocks/${msg.sourcePage.documentId})`)
        }
        lines.push('')
        lines.push(msg.content)
        lines.push('')
        lines.push('---')
      }
    }

    return lines.join('\n')
  }

  async function appendChatToWiki(params: {
    wikiStore: { getPageRecord: (pageKey: string) => Promise<{ pageId?: string, sourceDocumentIds?: string[] } | null> }
    getBlockKramdown: (id: string) => Promise<{ id: string, kramdown: string }>
    updateBlock: (dataType: 'markdown' | 'dom', data: string, id: string) => Promise<any>
  }): Promise<boolean> {
    const msgs = session.value.messages
    const userMsgs = msgs.filter(m => m.role === 'user')
    const assistantMsgs = msgs.filter(m => m.role === 'assistant')
    if (userMsgs.length === 0 || assistantMsgs.length === 0) return false

    const documentId = scope.value.mode === 'active' && scope.value.activeContent
      ? scope.value.activeContent.documentId
      : session.value.currentSourcePage?.documentId
    if (!documentId) return false

    const pageKey = `theme:${documentId}`
    const record = await params.wikiStore.getPageRecord(pageKey)
    const wikiPageId = record?.pageId
    if (!wikiPageId) return false

    const wikiBlock = await params.getBlockKramdown(wikiPageId)
    const kramdown = wikiBlock.kramdown ?? ''

    const manualHeading = t('wikiMaintain.manualNotes')
    const manualHeadingPattern = new RegExp(`^##\\s+${escapeRegExp(manualHeading)}\\s*$`, 'm')
    const manualMatch = kramdown.match(manualHeadingPattern)

    const chatMarkdown = buildChatAppendMarkdown()

    let updatedKramdown: string
    if (manualMatch && typeof manualMatch.index === 'number') {
      const insertIndex = manualMatch.index + manualMatch[0].length
      updatedKramdown = kramdown.slice(0, insertIndex)
        + '\n\n' + chatMarkdown
        + kramdown.slice(insertIndex)
    } else {
      updatedKramdown = kramdown + '\n\n## ' + manualHeading + '\n\n' + chatMarkdown
    }

    await params.updateBlock('markdown', updatedKramdown, wikiPageId)
    logger?.log('[WikiChat] appendChatToWiki: appended chat to wiki page', { wikiPageId, documentId })
    return true
  }

  function buildChatAppendMarkdown(): string {
    const msgs = session.value.messages
    const now = new Date().toLocaleString()
    const lines: string[] = [
      `### ${t('llmWiki.chat.chatTitle')} - ${now}`,
      '',
    ]

    let qIndex = 0
    for (const msg of msgs) {
      if (msg.role === 'user') {
        qIndex++
        lines.push(`**Q${qIndex}:** ${msg.content}`)
      } else if (msg.role === 'assistant') {
        lines.push(`**A${qIndex}:** ${msg.content}`)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  return {
    session,
    inputText,
    mentionPopupVisible,
    mentionFilter,
    filteredPages,
    syncMentionState,
    sendMessage,
    switchSource,
    switchToActiveDoc,
    resetSession,
    buildSaveMarkdown,
    appendChatToWiki,
  }
}
