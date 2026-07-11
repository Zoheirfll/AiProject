import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useNotifications as useNotificationsSocket } from './useNotifications'

const NotificationsContext = createContext(null)

const MAX_EVENTS = 30

const EVENT_LABEL = {
  mail: (p) => `Mail envoyé : ${p.subject || ''}`,
  mail_echec: (p) => `Échec d'envoi : ${p.subject || p.erreur || ''}`,
  import: (p) => `Import "${p.fichier}" ${p.status === 'SUCCESS' ? 'terminé' : 'en échec'} (${p.lignes_importees ?? 0} lignes)`,
  alerte: (p) => `Alerte "${p.regle}" envoyée pour ${p.employee}`,
  surveillance: (p) => `Surveillance "${p.tache}" exécutée`,
  erreur_ollama: (p) => `Erreur Ollama (${p.contexte}) : ${p.detail}`,
  workflow: (p) => `Workflow #${p.execution_id} — ${p.statut}`,
}

const EVENT_TONE = {
  mail: 'success',
  import: (p) => (p.status === 'SUCCESS' ? 'success' : 'error'),
  alerte: 'success',
  surveillance: 'success',
  mail_echec: 'error',
  erreur_ollama: 'error',
  workflow: (p) => (p.statut === 'ECHEC' ? 'error' : 'success'),
}

function describeEvent(payload) {
  const label = EVENT_LABEL[payload.type]
  const message = label ? label(payload) : `Événement : ${payload.type}`
  const toneEntry = EVENT_TONE[payload.type]
  const tone = typeof toneEntry === 'function' ? toneEntry(payload) : toneEntry || 'success'
  return { message, tone }
}

export function NotificationsProvider({ children }) {
  const [events, setEvents] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const handleMessage = useCallback((payload) => {
    const { message, tone } = describeEvent(payload)
    const id = ++idRef.current

    setEvents((prev) => [{ id, message, tone, payload, createdAt: new Date() }, ...prev].slice(0, MAX_EVENTS))
    setUnreadCount((prev) => prev + 1)
    setToasts((prev) => [...prev, { id, message, tone }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  useNotificationsSocket(handleMessage)

  const markAllRead = useCallback(() => setUnreadCount(0), [])
  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  const value = useMemo(
    () => ({ events, unreadCount, markAllRead, toasts, dismissToast }),
    [events, unreadCount, markAllRead, toasts, dismissToast]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotificationsCenter() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsCenter must be used within a NotificationsProvider')
  return ctx
}
