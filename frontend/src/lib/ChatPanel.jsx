import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChatSuggestions, fetchConversationMessages } from './api'
import { useChatSocket } from './useChatSocket'
import { Badge, Input, SendIcon } from './ui'

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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

export default function ChatPanel({ initialConversationId = null, onConversationId, compact = false }) {
  const [conversationId, setConversationId] = useState(initialConversationId || 'new')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [erreur, setErreur] = useState('')
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
      setMessages((prev) => [...prev, { role: 'ASSISTANT', content: fullText, outils_utilises: outilsUtilises }])
    },
    onError: (message) => setErreur(message),
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const handleSend = (text) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return
    setErreur('')
    setMessages((prev) => [...prev, { role: 'USER', content: trimmed }])
    send(trimmed)
    setInput('')
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-[28rem]' : 'h-[70vh]'}`}>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin px-1 py-2">
        {messages.length === 0 && !streaming && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Posez une question RH, ou essayez :</p>
            <div className="flex flex-wrap gap-2">
              {suggestionsQuery.data?.suggestions?.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="space-y-1">
            <Bubble role={m.role} content={m.content} />
            {m.role === 'ASSISTANT' && m.outils_utilises?.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-1">
                {m.outils_utilises.map((o) => (
                  <Badge key={o} tone="neutral">{OUTIL_LABEL[o] || o}</Badge>
                ))}
              </div>
            )}
          </div>
        ))}

        {streaming && (
          <div className="space-y-1">
            <Bubble role="ASSISTANT" content={streaming} />
            {outils.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-1">
                {outils.map((o) => (
                  <Badge key={o} tone="primary">{OUTIL_LABEL[o] || o}</Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
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
        />
        <button
          type="submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  )
}
