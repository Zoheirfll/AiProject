import { useEffect, useRef, useState } from 'react'

function wsUrl(conversationId) {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  return `${base.replace(/^http/, 'ws')}/ws/chat/${conversationId}/`
}

// Manages one chat WebSocket connection for a conversation ("new" to start
// one). Reconnects on conversationId change. Exposes send(message) and the
// live streaming state (tokens accumulate into `streaming`).
export function useChatSocket(conversationId, { onConversationId, onDone, onError } = {}) {
  const socketRef = useRef(null)
  const callbacksRef = useRef({ onConversationId, onDone, onError })
  callbacksRef.current = { onConversationId, onDone, onError }

  const [connected, setConnected] = useState(false)
  const [outils, setOutils] = useState([])
  const [streaming, setStreaming] = useState('')
  const outilsRef = useRef([])

  useEffect(() => {
    if (!conversationId) return undefined

    const socket = new WebSocket(wsUrl(conversationId))
    socketRef.current = socket

    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)

    socket.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }
      if (data.type === 'conversation') {
        callbacksRef.current.onConversationId?.(data.id)
      } else if (data.type === 'outils') {
        outilsRef.current = data.outils || []
        setOutils(outilsRef.current)
      } else if (data.type === 'token') {
        setStreaming((prev) => prev + data.content)
      } else if (data.type === 'done') {
        setStreaming((prev) => {
          callbacksRef.current.onDone?.(prev, outilsRef.current)
          return ''
        })
      } else if (data.type === 'erreur') {
        callbacksRef.current.onError?.(data.content)
        setStreaming('')
      }
    }

    return () => socket.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const send = (message) => {
    setStreaming('')
    setOutils([])
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ message }))
    }
  }

  return { connected, send, streaming, outils }
}
