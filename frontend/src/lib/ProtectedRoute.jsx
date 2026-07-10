import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Spinner } from './ui'

export function ProtectedRoute({ children, drhOnly = false }) {
  const { user, loading, isDrh } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (drhOnly && !isDrh) {
    return <Navigate to="/" replace />
  }

  return children
}
