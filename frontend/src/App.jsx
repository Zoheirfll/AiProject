import { NavLink, Route, Routes } from 'react-router-dom'
import AutomatisationsPage from './pages/AutomatisationsPage'
import ImportsPage from './pages/ImportsPage'
import MailApercuPage from './pages/MailApercuPage'
import MailsHistoriquePage from './pages/MailsHistoriquePage'

function DashboardPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-gray-900">GRH-Auto</h1>
        <p className="mt-2 text-gray-500">Plateforme d'automatisation RH — Sprint 3</p>
      </div>
    </div>
  )
}

function App() {
  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex items-center gap-1 border-b border-gray-200 bg-white px-6 py-3">
        <span className="mr-4 text-sm font-semibold tracking-tight text-gray-900">GRH-Auto</span>
        <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/imports" className={linkClass}>Imports</NavLink>
        <NavLink to="/automatisations" className={linkClass}>Automatisations</NavLink>
        <NavLink to="/mails/apercu" className={linkClass}>Aperçu mail</NavLink>
        <NavLink to="/mails/historique" className={linkClass}>Historique mails</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/automatisations" element={<AutomatisationsPage />} />
        <Route path="/mails/apercu" element={<MailApercuPage />} />
        <Route path="/mails/historique" element={<MailsHistoriquePage />} />
      </Routes>
    </div>
  )
}

export default App
