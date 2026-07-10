import { NavLink, Route, Routes } from 'react-router-dom'
import AutomatisationsPage from './pages/AutomatisationsPage'
import ConfigurationPage from './pages/ConfigurationPage'
import DashboardPage from './pages/DashboardPage'
import ImportsPage from './pages/ImportsPage'
import MailApercuPage from './pages/MailApercuPage'
import MailsHistoriquePage from './pages/MailsHistoriquePage'
import SurveillancePage from './pages/SurveillancePage'
import { BoltIcon, EyeIcon, GearIcon, GridIcon, HistoryIcon, MailIcon, MoonIcon, SunIcon, UploadIcon } from './lib/ui'
import { useTheme } from './lib/useTheme'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/imports', label: 'Imports', icon: UploadIcon },
  { to: '/automatisations', label: 'Automatisations', icon: BoltIcon },
  { to: '/surveillance', label: 'Surveillance', icon: EyeIcon },
  { to: '/mails/apercu', label: 'Aperçu mail', icon: MailIcon },
  { to: '/mails/historique', label: 'Historique mails', icon: HistoryIcon },
  { to: '/configuration', label: 'Configuration', icon: GearIcon },
]

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

function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            RH
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">GRH-Auto</span>
        </div>
        <ThemeToggle />
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
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
        Sprint 3 · Local-first · Loi 18/07
      </div>
    </aside>
  )
}

function App() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/imports" element={<ImportsPage />} />
          <Route path="/automatisations" element={<AutomatisationsPage />} />
          <Route path="/surveillance" element={<SurveillancePage />} />
          <Route path="/mails/apercu" element={<MailApercuPage />} />
          <Route path="/mails/historique" element={<MailsHistoriquePage />} />
          <Route path="/configuration" element={<ConfigurationPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
