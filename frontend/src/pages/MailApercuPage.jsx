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

export default function MailApercuPage() {
  const [employeeId, setEmployeeId] = useState('')
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

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!employeeId || !sujetDemande) return
    envoyerMutation.reset()
    apercuMutation.mutate({ employeeId, sujetDemande })
  }

  const handleEnvoyer = () => {
    if (!result?.id) return
    envoyerMutation.mutate({ mailLogId: result.id, subject: editedSubject, body: editedBody })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Aperçu mail (IA)"
        description="Génère un brouillon de mail RH via le modèle Ollama local, à relire et modifier avant envoi."
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Field label="Sujet demandé">
            <Input
              placeholder="Ex: rappel de renouvellement de contrat"
              value={sujetDemande}
              onChange={(e) => setSujetDemande(e.target.value)}
            />
          </Field>

          <Button type="submit" disabled={apercuMutation.isPending || !employeeId || !sujetDemande}>
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
          <div className="flex gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => apercuMutation.mutate({ employeeId, sujetDemande })}
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
