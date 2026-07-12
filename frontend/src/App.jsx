import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import AgentAnalystePage from './pages/AgentAnalystePage'
import AgentChatPage from './pages/AgentChatPage'
import AutomatisationsPage from './pages/AutomatisationsPage'
import ChatHistoriquePage from './pages/ChatHistoriquePage'
import ConfigurationPage from './pages/ConfigurationPage'
import DashboardPage from './pages/DashboardPage'
import ImportsPage from './pages/ImportsPage'
import LoginPage from './pages/LoginPage'
import LogsPage from './pages/LogsPage'
import MailApercuPage from './pages/MailApercuPage'
import MailsHistoriquePage from './pages/MailsHistoriquePage'
import OrchestrateurPage from './pages/OrchestrateurPage'
import SurveillancePage from './pages/SurveillancePage'
import UtilisateursPage from './pages/UtilisateursPage'
import { useAuth } from './lib/AuthContext'
import { FloatingChatWidget } from './lib/FloatingChatWidget'
import { NotificationsProvider, useNotificationsCenter } from './lib/NotificationsContext'
import { ProtectedRoute } from './lib/ProtectedRoute'
import {
  BellIcon,
  BoltIcon,
  ChatIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  GearIcon,
  GridIcon,
  HistoryIcon,
  LogoutIcon,
  MailIcon,
  MoonIcon,
  SparkleIcon,
  SunIcon,
  Toast,
  UploadIcon,
  UsersIcon,
  WorkflowIcon,
} from './lib/ui'
import { useTheme } from './lib/useTheme'

const N8N_URL = import.meta.env.VITE_N8N_URL || 'http://localhost:5678'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/imports', label: 'Imports', icon: UploadIcon },
  { to: '/automatisations', label: 'Automatisations', icon: BoltIcon },
  { to: '/surveillance', label: 'Surveillance', icon: EyeIcon },
  { to: '/mails/apercu', label: 'Aperçu mail', icon: MailIcon },
  { to: '/mails/historique', label: 'Historique mails', icon: HistoryIcon },
  { to: '/agents/analyste', label: 'Agent Analyste', icon: SparkleIcon },
  { to: '/agents/chat', label: 'Assistant Chat', icon: ChatIcon },
  { to: '/agents/orchestrateur', label: 'Orchestrateur', icon: WorkflowIcon, drhOnly: true },
  { to: '/utilisateurs', label: 'Utilisateurs', icon: UsersIcon, drhOnly: true },
  { to: '/logs', label: 'Logs', icon: FileTextIcon, drhOnly: true },
  { to: '/configuration', label: 'Configuration', icon: GearIcon, drhOnly: true },
]

const ROLE_LABEL = { DRH: 'DRH', CHARGE_RH: 'Chargé RH' }

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      aria-label="Changer de thème"
      title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function NotificationBell() {
  const { events, unreadCount, markAllRead } = useNotificationsCenter()
  const [open, setOpen] = useState(false)

  const toggle = () => {
    setOpen((prev) => !prev)
    if (!open) markAllRead()
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        title="Notifications"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {events.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">Aucune notification pour le moment.</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <p>{event.message}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {event.createdAt.toLocaleTimeString('fr-FR')}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ToastStack() {
  const { toasts, dismissToast } = useNotificationsCenter()
  if (toasts.length === 0) return null
  return (
    <div className="fixed right-4 top-4 z-50 w-80 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} tone={toast.tone === 'error' ? 'error' : 'success'} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  )
}

function Sidebar() {
  const { user, isDrh, logout } = useAuth()

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 100 100" className="h-8 w-8 shrink-0" aria-hidden="true">
            <defs>
              <linearGradient id="sidebarBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E40AF" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
              <linearGradient id="sidebarEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <path d="M 50 5 L 90 28 L 90 72 L 50 95 L 10 72 L 10 28 Z" fill="url(#sidebarBlue)" />
            <path d="M 25 50 C 25 35, 45 25, 50 45 C 55 65, 75 55, 75 40" fill="none" stroke="url(#sidebarEmerald)" strokeWidth="6" strokeLinecap="round" />
            <circle cx="25" cy="50" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="75" cy="40" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <circle cx="50" cy="27" r="7" fill="#FFFFFF" />
            <path d="M 37 72 C 37 58, 43 54, 50 54 C 57 54, 63 58, 63 72 Z" fill="#FFFFFF" />
            <circle cx="50" cy="45" r="4" fill="#FFFFFF" />
          </svg>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
              GRH<span className="text-primary-600 dark:text-primary-400">Auto</span>
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Plateforme RH
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.filter((item) => !item.drhOnly || isDrh).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-linear-to-r from-primary-600 to-primary-500 text-white shadow-sm shadow-primary-600/25'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-4 w-4 shrink-0 transition-transform duration-150 ${isActive ? '' : 'group-hover:scale-110'}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
        {isDrh && (
          <a
            href={N8N_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
          >
            <ExternalLinkIcon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
            n8n
          </a>
        )}
      </nav>

      <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700">
        {user && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{user.username}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{ROLE_LABEL[user.role] || user.role}</p>
            </div>
            <button
              onClick={logout}
              aria-label="Déconnexion"
              title="Déconnexion"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <LogoutIcon />
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">Local-first · Loi 18/07</p>
      </div>
    </aside>
  )
}

function AppShell() {
  return (
    <NotificationsProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <Sidebar />
        <ToastStack />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/automatisations" element={<AutomatisationsPage />} />
            <Route path="/surveillance" element={<SurveillancePage />} />
            <Route path="/mails/apercu" element={<MailApercuPage />} />
            <Route path="/mails/historique" element={<MailsHistoriquePage />} />
            <Route path="/agents/analyste" element={<AgentAnalystePage />} />
            <Route path="/agents/chat" element={<AgentChatPage />} />
            <Route path="/agents/chat/historique" element={<ChatHistoriquePage />} />
            <Route path="/agents/chat/:conversationId" element={<AgentChatPage />} />
            <Route
              path="/agents/orchestrateur"
              element={
                <ProtectedRoute drhOnly>
                  <OrchestrateurPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuration"
              element={
                <ProtectedRoute drhOnly>
                  <ConfigurationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilisateurs"
              element={
                <ProtectedRoute drhOnly>
                  <UtilisateursPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute drhOnly>
                  <LogsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        <FloatingChatWidget />
      </div>
    </NotificationsProvider>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
