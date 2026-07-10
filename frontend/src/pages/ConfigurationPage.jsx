import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  fetchAgentConfig,
  fetchAutomatisationConfig,
  fetchModelesDisponibles,
  saveAgentConfig,
  saveAutomatisationConfig,
  testerSmtp,
} from '../lib/api'
import { describeApiError } from '../lib/errors'
import { Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea, Toast } from '../lib/ui'

const AGENTS = [
  { key: 'analyste', label: 'Agent Analyste' },
  { key: 'chat', label: 'Assistant Chat' },
  { key: 'orchestrateur', label: 'Orchestrateur' },
]

function AgentsConfigCard() {
  const [form, setForm] = useState({
    modele_analyste: '',
    modele_chat: '',
    modele_orchestrateur: '',
    timeout_secondes: 60,
    max_iterations: 5,
    analyste_destinataires: '',
  })
  const [saved, setSaved] = useState(false)

  const configQuery = useQuery({ queryKey: ['agent-config'], queryFn: fetchAgentConfig })
  const modelesQuery = useQuery({ queryKey: ['modeles-disponibles'], queryFn: fetchModelesDisponibles })

  useEffect(() => {
    if (configQuery.data) {
      setForm({
        ...configQuery.data,
        analyste_destinataires: (configQuery.data.analyste_destinataires || []).join(', '),
      })
    }
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: saveAgentConfig,
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      analyste_destinataires: form.analyste_destinataires
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    })
  }

  const modeles = modelesQuery.data?.modeles || []

  return (
    <Card className="space-y-5">
      <div>
        <h3 className="font-medium text-slate-900 dark:text-slate-50">Modèles Ollama par agent</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Laissez vide pour utiliser le modèle par défaut de l'application.
          {modelesQuery.isError && ' (Ollama injoignable — impossible de lister les modèles installés.)'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {AGENTS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <Select
              value={form[`modele_${key}`]}
              onChange={(e) => setForm((f) => ({ ...f, [`modele_${key}`]: e.target.value }))}
            >
              <option value="">Modèle par défaut</option>
              {modeles.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </Field>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Timeout (secondes)">
          <Input
            type="number"
            min="1"
            value={form.timeout_secondes}
            onChange={(e) => setForm((f) => ({ ...f, timeout_secondes: e.target.value }))}
          />
        </Field>
        <Field label="Nombre max d'itérations">
          <Input
            type="number"
            min="1"
            value={form.max_iterations}
            onChange={(e) => setForm((f) => ({ ...f, max_iterations: e.target.value }))}
          />
        </Field>
      </div>

      <Field label="Destinataires des alertes de l'agent Analyste" hint="Emails fixes, 'departement:X', ou 'tous'.">
        <Input
          value={form.analyste_destinataires}
          onChange={(e) => setForm((f) => ({ ...f, analyste_destinataires: e.target.value }))}
          placeholder="rh@example.com, departement:IT"
        />
      </Field>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Spinner />}
          Enregistrer
        </Button>
        {saved && <span className="text-sm text-emerald-600">Configuration enregistrée.</span>}
      </div>
    </Card>
  )
}

export default function ConfigurationPage() {
  const [prompt, setPrompt] = useState('')
  const [heure, setHeure] = useState('09:00')
  const [saved, setSaved] = useState(false)

  const configQuery = useQuery({ queryKey: ['automatisations-config'], queryFn: fetchAutomatisationConfig })
  const smtpTestMutation = useMutation({ mutationFn: testerSmtp })

  useEffect(() => {
    if (configQuery.data) {
      setPrompt(configQuery.data.prompt_global || '')
      setHeure((configQuery.data.heure_rapport_quotidien || '09:00').slice(0, 5))
    }
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: saveAutomatisationConfig,
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Configuration"
        description="Prompt Ollama global et horaire du rapport quotidien — utilisés par les automatisations."
      />

      {configQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
      ) : (
        <Card className="space-y-5">
          <Field
            label="Prompt Ollama global"
            hint="Utilisé par défaut pour le rapport quotidien et pour toute règle sans prompt spécifique. Variables disponibles : {{nom}}, {{departement}}, {{date_fin}}, {{jours_restants}}."
          >
            <Textarea
              className="min-h-[160px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tu es un assistant RH. Rédige..."
            />
          </Field>

          <Field label="Heure du rapport quotidien">
            <input
              type="time"
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              onClick={() => saveMutation.mutate({ prompt_global: prompt, heure_rapport_quotidien: heure })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Spinner />}
              Enregistrer
            </Button>
            {saved && <span className="text-sm text-emerald-600">Configuration enregistrée.</span>}
          </div>
        </Card>
      )}

      {saveMutation.isError && (
        <Toast tone="error" message="Échec de l'enregistrement de la configuration." onDismiss={() => {}} />
      )}

      <AgentsConfigCard />

      <Card className="space-y-3">
        <div>
          <h3 className="font-medium text-slate-900 dark:text-slate-50">Connexion SMTP</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vérifie que les identifiants SMTP dans <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">.env</code> fonctionnent, sans envoyer de mail.
          </p>
        </div>
        <Button variant="secondary" onClick={() => smtpTestMutation.mutate()} disabled={smtpTestMutation.isPending}>
          {smtpTestMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
          Tester la connexion SMTP
        </Button>
        {smtpTestMutation.isSuccess && (
          <Toast tone="success" message="Connexion SMTP OK." onDismiss={() => smtpTestMutation.reset()} />
        )}
        {smtpTestMutation.isError && (
          <Toast
            tone="error"
            message={describeApiError(smtpTestMutation.error, 'Échec du test SMTP.')}
            onDismiss={() => smtpTestMutation.reset()}
          />
        )}
      </Card>
    </div>
  )
}
