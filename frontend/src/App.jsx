import { NavLink, Route, Routes } from 'react-router-dom'
import AutomatisationsPage from './pages/AutomatisationsPage'
import ImportsPage from './pages/ImportsPage'
import MailApercuPage from './pages/MailApercuPage'
import MailsHistoriquePage from './pages/MailsHistoriquePage'
import { BoltIcon, GridIcon, HistoryIcon, MailIcon, UploadIcon } from './lib/ui'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/imports', label: 'Imports', icon: UploadIcon },
  { to: '/automatisations', label: 'Automatisations', icon: BoltIcon },
  { to: '/mails/apercu', label: 'Aperçu mail', icon: MailIcon },
  { to: '/mails/historique', label: 'Historique mails', icon: HistoryIcon },
]

function DashboardPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-xl font-bold text-white shadow-[var(--shadow-raised)]">
          RH
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">GRH-Auto</h1>
        <p className="mt-2 text-sm text-slate-500">Plateforme d'automatisation RH — Sprint 3</p>
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
          RH
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-900">GRH-Auto</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
        Sprint 3 · Local-first · Loi 18/07
      </div>
    </aside>
  )
}

function App() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/imports" element={<ImportsPage />} />
          <Route path="/automatisations" element={<AutomatisationsPage />} />
          <Route path="/mails/apercu" element={<MailApercuPage />} />
          <Route path="/mails/historique" element={<MailsHistoriquePage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
