import { NavLink, Route, Routes } from 'react-router-dom'
import ImportsPage from './pages/ImportsPage'

function DashboardPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-gray-900">GRH-Auto</h1>
        <p className="mt-2 text-gray-500">Plateforme d'automatisation RH — Phase 2</p>
      </div>
    </div>
  )
}

function App() {
  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="border-b border-gray-200 bg-white px-6 py-3 flex gap-2">
        <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/imports" className={linkClass}>Imports</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
      </Routes>
    </div>
  )
}

export default App
