import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Route, Routes } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AutomatisationsPage from './pages/AutomatisationsPage'
import ImportsPage from './pages/ImportsPage'
import MailApercuPage from './pages/MailApercuPage'
import MailsHistoriquePage from './pages/MailsHistoriquePage'
import SurveillancePage from './pages/SurveillancePage'
import { fetchEmployees } from './lib/api'
import { BoltIcon, Card, EyeIcon, GridIcon, HistoryIcon, MailIcon, MoonIcon, Spinner, SunIcon, UploadIcon } from './lib/ui'
import { chartPalette } from './theme'
import { useTheme } from './lib/useTheme'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/imports', label: 'Imports', icon: UploadIcon },
  { to: '/automatisations', label: 'Automatisations', icon: BoltIcon },
  { to: '/surveillance', label: 'Surveillance', icon: EyeIcon },
  { to: '/mails/apercu', label: 'Aperçu mail', icon: MailIcon },
  { to: '/mails/historique', label: 'Historique mails', icon: HistoryIcon },
]

function EmployeesByDepartmentChart() {
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() })

  const data = useMemo(() => {
    const counts = {}
    for (const emp of employeesQuery.data || []) {
      const dept = emp.departement || 'Non renseigné'
      counts[dept] = (counts[dept] || 0) + 1
    }
    return Object.entries(counts).map(([departement, effectif]) => ({ departement, effectif }))
  }, [employeesQuery.data])

  if (employeesQuery.isLoading) {
    return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
  }

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Aucun employé importé pour l'instant.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
        <XAxis dataKey="departement" tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
        />
        <Bar dataKey="effectif" fill={chartPalette[0]} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-xl font-bold text-white shadow-[var(--shadow-raised)]">
          RH
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">GRH-Auto</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Plateforme d'automatisation RH — Sprint 3</p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Effectif par département</h2>
        <EmployeesByDepartmentChart />
      </Card>
    </div>
  )
}

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
        </Routes>
      </main>
    </div>
  )
}

export default App
