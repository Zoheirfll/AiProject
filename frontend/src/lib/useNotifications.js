import { useEffect, useRef } from 'react'

function wsUrl() {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  return base.replace(/^http/, 'ws') + '/ws/notifications/'
}

// Subscribes to the backend's real-time notification WebSocket and invokes
// onMessage(payload) for every event pushed by integrations.notifications.notify().
// Reconnects automatically (fixed 3s backoff) if the connection drops.
export function useNotifications(onMessage) {
  const callbackRef = useRef(onMessage)
  callbackRef.current = onMessage

  useEffect(() => {
    let socket
    let reconnectTimer
    let stopped = false

    const connect = () => {
      socket = new WebSocket(wsUrl())
      socket.onmessage = (event) => {
        try {
          callbackRef.current?.(JSON.parse(event.data))
        } catch {
          // ignore malformed payloads
        }
      }
      socket.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(connect, 3000)
      }
      socket.onerror = () => socket.close()
    }

    connect()

    return () => {
      stopped = true
      clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])
}
