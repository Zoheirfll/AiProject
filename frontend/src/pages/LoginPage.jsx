import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { describeApiError } from '../lib/errors'
import { Button, EyeIcon, Field, Input, Spinner, Toast } from '../lib/ui'

function BrandMark({ className = 'h-16 w-16' }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="loginBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="loginEmerald" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <path d="M 50 5 L 90 28 L 90 72 L 50 95 L 10 72 L 10 28 Z" fill="url(#loginBlue)" />
      <path d="M 25 50 C 25 35, 45 25, 50 45 C 55 65, 75 55, 75 40" fill="none" stroke="url(#loginEmerald)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="25" cy="50" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="75" cy="40" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="50" cy="27" r="7" fill="#FFFFFF" />
      <path d="M 37 72 C 37 58, 43 54, 50 54 C 57 54, 63 58, 63 72 Z" fill="#FFFFFF" />
      <circle cx="50" cy="45" r="4" fill="#FFFFFF" />
    </svg>
  )
}

export default function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (user) {
    const redirectTo = location.state?.from?.pathname || '/'
    return <Navigate to={redirectTo} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(describeApiError(err, 'Échec de la connexion. Réessayez.'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-900">
      {/* Brand panel — hidden on small screens */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-linear-to-br from-primary-800 via-primary-700 to-primary-600 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)',
            backgroundSize: '48px 48px, 64px 64px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-10 w-10" />
          <span className="text-lg font-bold tracking-tight">
            GRH<span className="text-accent-300">Auto</span>
          </span>
        </div>

        <div className="relative">
          <h1 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">
            L'automatisation RH, pensée pour la conformité locale.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-primary-100/80">
            Imports, alertes contractuelles, agents IA et workflows — exécutés localement,
            sans donnée qui quitte le territoire.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-xs font-medium text-primary-100/70">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
          Local-first · Loi 18/07
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <BrandMark className="mb-4 h-12 w-12 lg:hidden" />
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Bon retour
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Connectez-vous pour accéder à votre espace RH.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nom d'utilisateur">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Mot de passe">
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <EyeIcon className="h-4 w-4" />
                </button>
              </div>
            </Field>

            {error && <Toast tone="error" message={error} onDismiss={() => setError('')} />}

            <Button type="submit" className="w-full justify-center" size="lg" disabled={pending}>
              {pending && <Spinner />}
              {pending ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600 lg:text-left">
            Accès réservé au personnel RH autorisé.
          </p>
        </div>
      </div>
    </div>
  )
}
