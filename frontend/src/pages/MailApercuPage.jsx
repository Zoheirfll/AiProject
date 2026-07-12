import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import {
  envoyerMail,
  envoyerMailsMasse,
  fetchEmployees,
  generateMailApercu,
  generateMailApercuMasse,
} from '../lib/api'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  MailIcon,
  PageHeader,
  Select,
  SendIcon,
  Spinner,
  Textarea,
  Toast,
  UploadIcon,
} from '../lib/ui'
import { statusTone } from '../theme'
import { describeApiError } from '../lib/errors'

const MODES = [
  { value: 'employee', label: 'Employé existant' },
  { value: 'adhoc', label: 'Adresse libre' },
  { value: 'excel', label: 'Excel (envoi en masse)' },
]

function SegmentedControl({ options, value, onChange, size = 'md', className = '' }) {
  const sizeClasses = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/60 ${className}`}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900 ${sizeClasses} ${
              active
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SingleMailFlow({ mode, employeesQuery }) {
  const [employeeId, setEmployeeId] = useState('')
  const [destinataireNom, setDestinataireNom] = useState('')
  const [destinataireEmail, setDestinataireEmail] = useState('')
  const [sujetDemande, setSujetDemande] = useState('')
  const [format, setFormat] = useState('TEXTE')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')

  const apercuMutation = useMutation({ mutationFn: generateMailApercu })
  const envoyerMutation = useMutation({ mutationFn: envoyerMail })
  const result = apercuMutation.data

  useEffect(() => {
    if (result?.status === 'DRAFT') {
      setEditedSubject(result.subject)
      setEditedBody(result.body)
    }
  }, [result])

  const isValid = sujetDemande && (mode === 'employee' ? employeeId : destinataireEmail)

  const buildPayload = () => ({
    employeeId: mode === 'employee' ? employeeId : undefined,
    destinataireNom: mode === 'adhoc' ? destinataireNom : undefined,
    destinataireEmail: mode === 'adhoc' ? destinataireEmail : undefined,
    sujetDemande,
    format,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!isValid) return
    envoyerMutation.reset()
    apercuMutation.mutate(buildPayload())
  }

  const handleEnvoyer = () => {
    if (!result?.id) return
    envoyerMutation.mutate({ mailLogId: result.id, subject: editedSubject, body: editedBody, format })
  }

  const handleAnnuler = () => {
    apercuMutation.reset()
    envoyerMutation.reset()
    setEditedSubject('')
    setEditedBody('')
  }

  return (
    <>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Sujet demandé">
              <Input
                placeholder="Ex: rappel de renouvellement de contrat"
                value={sujetDemande}
                onChange={(e) => setSujetDemande(e.target.value)}
              />
            </Field>
            <Field label="Format">
              <SegmentedControl
                size="sm"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'TEXTE', label: 'Texte' },
                  { value: 'HTML', label: 'HTML' },
                ]}
              />
            </Field>
          </div>

          <Button type="submit" disabled={apercuMutation.isPending || !isValid}>
            {apercuMutation.isPending ? <Spinner className="h-4 w-4" /> : <MailIcon />}
            {apercuMutation.isPending ? 'Génération…' : 'Générer un aperçu'}
          </Button>
        </form>
      </Card>

      {apercuMutation.isError && (
        <Toast tone="error" message={describeApiError(apercuMutation.error, 'Erreur lors de la génération.')} onDismiss={() => apercuMutation.reset()} />
      )}

      {result && result.status === 'FAILED' && <Toast tone="error" message={result.erreur} onDismiss={() => {}} />}

      {result && result.status === 'DRAFT' && (
        <Card className="space-y-4">
          <Field label="Objet">
            <Input value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} />
          </Field>

          {format === 'HTML' ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field label="Corps (source HTML)">
                <Textarea className="min-h-50" value={editedBody} onChange={(e) => setEditedBody(e.target.value)} />
              </Field>

              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">Aperçu</p>
                <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-600">
                  <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">Aperçu du mail</span>
                  </div>
                  <div
                    className="min-h-50 bg-white p-4 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editedBody) }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <Field label="Corps">
              <Textarea className="min-h-50" value={editedBody} onChange={(e) => setEditedBody(e.target.value)} />
            </Field>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              type="button"
              onClick={handleEnvoyer}
              disabled={envoyerMutation.isPending}
            >
              {envoyerMutation.isPending ? <Spinner className="h-4 w-4" /> : <SendIcon />}
              {envoyerMutation.isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => apercuMutation.mutate(buildPayload())}
              disabled={apercuMutation.isPending}
            >
              {apercuMutation.isPending && <Spinner className="h-3.5 w-3.5" />} Régénérer via Ollama
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto"
              onClick={handleAnnuler}
              disabled={envoyerMutation.isPending}
            >
              Annuler
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
              message={describeApiError(envoyerMutation.error, "Échec de l'envoi.")}
              onDismiss={() => envoyerMutation.reset()}
            />
          )}
        </Card>
      )}
    </>
  )
}

function ExcelMasseFlow() {
  const fileInputRef = useRef(null)
  const [sujetDemande, setSujetDemande] = useState('')
  const [drafts, setDrafts] = useState(null)
  const [sentResults, setSentResults] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const apercuMasseMutation = useMutation({
    mutationFn: generateMailApercuMasse,
    onSuccess: (data) => {
      setSentResults(null)
      setDrafts(data.drafts.map((d) => ({ ...d })))
    },
  })

  const envoyerMasseMutation = useMutation({
    mutationFn: envoyerMailsMasse,
    onSuccess: (data) => setSentResults(data),
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) apercuMasseMutation.mutate({ file, sujetDemande })
  }

  const updateDraft = (id, patch) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  const handleEnvoyerTout = () => {
    const sendable = drafts.filter((d) => d.status === 'DRAFT')
    envoyerMasseMutation.mutate(
      sendable.map((d) => ({ mail_log_id: d.id, subject: d.subject, body: d.body }))
    )
  }

  const resultById = new Map((sentResults || []).map((r) => [r.id, r]))
  const sendableCount = drafts?.filter((d) => d.status === 'DRAFT').length || 0

  return (
    <div className="space-y-6">
      <Card className="flex items-center justify-between border-dashed">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
            <UploadIcon />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">Fichier .xlsx (colonnes : email, nom, sujet)</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              La colonne <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">sujet</code> est optionnelle si un sujet par défaut est renseigné ci-dessous.
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-1 dark:focus-within:ring-offset-slate-900">
          {apercuMasseMutation.isPending && <Spinner className="h-4 w-4" />}
          {apercuMasseMutation.isPending ? 'Génération…' : 'Choisir un fichier'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            disabled={apercuMasseMutation.isPending}
          />
        </label>
      </Card>

      <Field label="Sujet par défaut" hint="Utilisé pour les lignes sans colonne sujet renseignée.">
        <Input
          placeholder="Ex: Relance facture impayée"
          value={sujetDemande}
          onChange={(e) => setSujetDemande(e.target.value)}
        />
      </Field>

      {apercuMasseMutation.isError && (
        <Toast
          tone="error"
          message={describeApiError(apercuMasseMutation.error, 'Échec de la génération en masse.')}
          onDismiss={() => apercuMasseMutation.reset()}
        />
      )}

      {drafts && drafts.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{drafts.length}</span> brouillon(s)
              prêt(s)
            </p>
            <Button onClick={handleEnvoyerTout} disabled={envoyerMasseMutation.isPending || sendableCount === 0}>
              {envoyerMasseMutation.isPending ? <Spinner className="h-4 w-4" /> : <SendIcon />}
              {envoyerMasseMutation.isPending ? 'Envoi…' : `Envoyer tout (${sendableCount})`}
            </Button>
          </div>

          <div className="space-y-3">
            {drafts.map((draft) => {
              const sent = resultById.get(draft.id)
              const status = sent?.status || draft.status
              const editable = draft.status === 'DRAFT' && !sent
              const expanded = expandedId === draft.id
              return (
                <Card key={draft.id} className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900"
                    onClick={() => editable && setExpandedId(expanded ? null : draft.id)}
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {draft.destinataire_nom || draft.destinataire_email}
                      </p>
                      <p className="truncate text-sm text-slate-400">{draft.destinataire_email}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{draft.subject}</p>
                    </div>
                    <Badge tone={statusTone[status] || 'neutral'}>
                      {status === 'SENT' ? 'Envoyé' : status === 'FAILED' ? 'Échec' : 'Brouillon'}
                    </Badge>
                  </button>

                  {status === 'FAILED' && (sent?.erreur || draft.erreur) && (
                    <p className="text-sm text-red-600">{sent?.erreur || draft.erreur}</p>
                  )}

                  {editable && expanded && (
                    <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                      <Field label="Objet">
                        <Input
                          value={draft.subject}
                          onChange={(e) => updateDraft(draft.id, { subject: e.target.value })}
                        />
                      </Field>
                      <Field label="Corps">
                        <Textarea
                          className="min-h-25"
                          value={draft.body}
                          onChange={(e) => updateDraft(draft.id, { body: e.target.value })}
                        />
                      </Field>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}

      {drafts && drafts.length === 0 && (
        <EmptyState
          title="Aucune ligne exploitable"
          description="Le fichier ne contient aucune ligne utilisable pour générer un brouillon."
        />
      )}

      {!drafts && (
        <EmptyState
          title="Aucun brouillon pour l'instant"
          description="Importez un fichier Excel pour générer des brouillons de mail en masse."
        />
      )}
    </div>
  )
}

export default function MailApercuPage() {
  const [mode, setMode] = useState('employee')
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Aperçu mail (IA)"
        description="Génère un brouillon de mail via le modèle Ollama local, à relire et modifier avant envoi."
      />

      <SegmentedControl options={MODES} value={mode} onChange={setMode} />

      {mode === 'excel' ? (
        <ExcelMasseFlow />
      ) : (
        <SingleMailFlow mode={mode} employeesQuery={employeesQuery} />
      )}
    </div>
  )
}
