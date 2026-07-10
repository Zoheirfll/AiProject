import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { describeApiError } from '../lib/errors'
import { Button, Card, Field, Input, Spinner, Toast } from '../lib/ui'

export default function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
      <Card className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-lg font-bold text-white">
            RH
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">GRH-Auto</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Connectez-vous pour continuer.</p>
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
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && <Toast tone="error" message={error} onDismiss={() => setError('')} />}

          <Button type="submit" className="w-full justify-center" disabled={pending}>
            {pending && <Spinner />}
            {pending ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
