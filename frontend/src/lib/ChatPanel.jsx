import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChatSuggestions, fetchConversationMessages } from './api'
import { useChatSocket } from './useChatSocket'
import { Badge, ChatIcon, Input, SendIcon, Spinner } from './ui'

const OUTIL_LABEL = {
  effectif_total: "Effectif total",
  effectif_par_departement: "Effectif par département",
  contrats_expirant: "Contrats expirant",
  repartition_types_contrat: "Types de contrat",
  regles_actives: "Règles actives",
}

function Bubble({ role, content }) {
  const isUser = role === 'USER' || role === 'user'
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
          <ChatIcon className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-[var(--shadow-card)] [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] dark:[&_code]:bg-white/10 ${
          isUser
            ? 'rounded-br-md bg-primary-600 text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
        <ChatIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-card)] dark:border-slate-700 dark:bg-slate-800">
        <span className="motion-safe:animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:-0.3s] motion-reduce:opacity-60" />
        <span className="motion-safe:animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:-0.15s] motion-reduce:opacity-60" />
        <span className="motion-safe:animate-bounce h-1.5 w-1.5 rounded-full bg-slate-400 motion-reduce:opacity-60" />
      </div>
    </div>
  )
}

export default function ChatPanel({ initialConversationId = null, onConversationId, compact = false }) {
  const [conversationId, setConversationId] = useState(initialConversationId || 'new')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [erreur, setErreur] = useState('')
  const [pending, setPending] = useState(false)
  const scrollRef = useRef(null)

  const suggestionsQuery = useQuery({ queryKey: ['chat-suggestions'], queryFn: fetchChatSuggestions })

  useEffect(() => {
    if (initialConversationId) {
      setConversationId(initialConversationId)
      fetchConversationMessages(initialConversationId).then(setMessages).catch(() => {})
    }
  }, [initialConversationId])

  const { send, streaming, outils } = useChatSocket(conversationId, {
    onConversationId: (id) => {
      setConversationId(String(id))
      onConversationId?.(id)
    },
    onDone: (fullText, outilsUtilises) => {
      setPending(false)
      setMessages((prev) => [...prev, { role: 'ASSISTANT', content: fullText, outils_utilises: outilsUtilises }])
    },
    onError: (message) => {
      setPending(false)
      setErreur(message)
    },
  })

  useEffect(() => {
    if (streaming) setPending(false)
  }, [streaming])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming, pending])

  const handleSend = (text) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return
    setErreur('')
    setPending(true)
    setMessages((prev) => [...prev, { role: 'USER', content: trimmed }])
    send(trimmed)
    setInput('')
  }

  const isBusy = pending || Boolean(streaming)

  return (
    <div className={`flex flex-col ${compact ? 'h-[28rem]' : 'h-[70vh]'}`}>
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-1 py-2">
        {messages.length === 0 && !streaming && !pending && (
          <div className="space-y-2.5">
            <p className="text-sm text-slate-400">Posez une question RH, ou essayez :</p>
            <div className="flex flex-wrap gap-2">
              {suggestionsQuery.data?.suggestions?.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:border-slate-600 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:bg-primary-900/30 dark:hover:text-primary-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <Bubble role={m.role} content={m.content} />
            {m.role === 'ASSISTANT' && m.outils_utilises?.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-9">
                {m.outils_utilises.map((o) => (
                  <Badge key={o} tone="neutral">{OUTIL_LABEL[o] || o}</Badge>
                ))}
              </div>
            )}
          </div>
        ))}

        {pending && !streaming && <TypingIndicator />}

        {streaming && (
          <div className="space-y-1.5">
            <Bubble role="ASSISTANT" content={streaming} />
            {outils.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-9">
                {outils.map((o) => (
                  <Badge key={o} tone="primary">{OUTIL_LABEL[o] || o}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {erreur && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
            {erreur}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez votre question…"
          className="rounded-full"
          disabled={isBusy}
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          aria-label="Envoyer"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary-600 text-white shadow-[var(--shadow-card)] transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-600 dark:focus-visible:ring-offset-slate-900"
        >
          {isBusy ? <Spinner className="h-4 w-4 text-white" /> : <SendIcon />}
        </button>
      </form>
    </div>
  )
}
