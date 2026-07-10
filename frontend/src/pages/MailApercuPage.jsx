import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { envoyerMail, fetchEmployees, generateMailApercu } from '../lib/api'
import {
  Button,
  Card,
  Field,
  Input,
  MailIcon,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  Toast,
} from '../lib/ui'

const MODES = [
  { value: 'employee', label: 'Employé existant' },
  { value: 'adhoc', label: 'Adresse libre' },
]

export default function MailApercuPage() {
  const [mode, setMode] = useState('employee')
  const [employeeId, setEmployeeId] = useState('')
  const [destinataireNom, setDestinataireNom] = useState('')
  const [destinataireEmail, setDestinataireEmail] = useState('')
  const [sujetDemande, setSujetDemande] = useState('')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')

  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() })
  const apercuMutation = useMutation({ mutationFn: generateMailApercu })
  const result = apercuMutation.data

  useEffect(() => {
    if (result?.status === 'DRAFT') {
      setEditedSubject(result.subject)
      setEditedBody(result.body)
    }
  }, [result])

  const envoyerMutation = useMutation({ mutationFn: envoyerMail })

  const isValid =
    sujetDemande && (mode === 'employee' ? employeeId : destinataireEmail)

  const buildPayload = () => ({
    employeeId: mode === 'employee' ? employeeId : undefined,
    destinataireNom: mode === 'adhoc' ? destinataireNom : undefined,
    destinataireEmail: mode === 'adhoc' ? destinataireEmail : undefined,
    sujetDemande,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    envoyerMutation.reset()
    apercuMutation.mutate(buildPayload())
  }

  const handleEnvoyer = () => {
    if (!result?.id) return
    envoyerMutation.mutate({ mailLogId: result.id, subject: editedSubject, body: editedBody })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Aperçu mail (IA)"
        description="Génère un brouillon de mail via le modèle Ollama local, à relire et modifier avant envoi."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === m.value
                    ? 'bg-primary-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'employee' ? (
            <Field label="Employé">
              <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                <option value="">Sélectionner…</option>
                {employeesQuery.data?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.prenom} {emp.nom} — {emp.matricule}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom du destinataire" hint="Optionnel, pour personnaliser le mail.">
                <Input
                  placeholder="Ex: Fournisseur ABC"
                  value={destinataireNom}
                  onChange={(e) => setDestinataireNom(e.target.value)}
                />
              </Field>
              <Field label="Email du destinataire">
                <Input
                  type="email"
                  placeholder="contact@example.com"
                  value={destinataireEmail}
                  onChange={(e) => setDestinataireEmail(e.target.value)}
                  required
                />
              </Field>
            </div>
          )}

          <Field label="Sujet demandé">
            <Input
              placeholder="Ex: rappel de renouvellement de contrat"
              value={sujetDemande}
              onChange={(e) => setSujetDemande(e.target.value)}
            />
          </Field>

          <Button type="submit" disabled={apercuMutation.isPending || !isValid}>
            {apercuMutation.isPending && <Spinner />}
            <MailIcon />
            {apercuMutation.isPending ? 'Génération…' : 'Générer un aperçu'}
          </Button>
        </form>
      </Card>

      {apercuMutation.isError && (
        <Toast tone="error" message={apercuMutation.error?.response?.data?.detail || 'Erreur lors de la génération.'} onDismiss={() => apercuMutation.reset()} />
      )}

      {result && result.status === 'FAILED' && (
        <Toast tone="error" message={result.erreur} onDismiss={() => {}} />
      )}

      {result && result.status === 'DRAFT' && (
        <Card className="space-y-4">
          <Field label="Objet">
            <Input value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} />
          </Field>
          <Field label="Corps">
            <Textarea className="min-h-50" value={editedBody} onChange={(e) => setEditedBody(e.target.value)} />
          </Field>
          <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => apercuMutation.mutate(buildPayload())}
              disabled={apercuMutation.isPending}
            >
              {apercuMutation.isPending && <Spinner className="h-3.5 w-3.5" />} Régénérer via Ollama
            </Button>
            <Button type="button" onClick={handleEnvoyer} disabled={envoyerMutation.isPending}>
              {envoyerMutation.isPending && <Spinner />} {envoyerMutation.isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </div>
          {envoyerMutation.isSuccess && (
            <Toast
              tone="success"
              message={envoyerMutation.data.status === 'SENT' ? 'Envoyé avec succès.' : envoyerMutation.data.status}
              onDismiss={() => envoyerMutation.reset()}
            />
          )}
          {envoyerMutation.isError && (
            <Toast
              tone="error"
              message={envoyerMutation.error?.response?.data?.detail || "Échec de l'envoi."}
              onDismiss={() => envoyerMutation.reset()}
            />
          )}
        </Card>
      )}
    </div>
  )
}
