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
import {
  Badge,
  Button,
  Card,
  Field,
  GearIcon,
  HelpBanner,
  useHelpBanner,
  Input,
  MailIcon,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  Toast,
} from '../lib/ui'

const AGENTS = [
  { key: 'analyste', label: 'Agent Analyste' },
  { key: 'chat', label: 'Assistant Chat' },
  { key: 'orchestrateur', label: 'Orchestrateur' },
]

function WarningIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5h.01" />
    </svg>
  )
}

function SectionHeader({ title, description, icon }) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
          {icon}
        </span>
      )}
      <div>
        <h3 className="font-medium text-slate-900 dark:text-slate-50">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
    </div>
  )
}

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
    <Card className="space-y-6">
      <SectionHeader
        icon={<GearIcon className="h-4.5 w-4.5" />}
        title="Modèles Ollama par agent"
        description="Laissez un champ vide pour utiliser le modèle par défaut de l'application."
      />

      {modelesQuery.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Ollama injoignable — impossible de lister les modèles installés localement. Saisie manuelle indisponible pour l'instant.</span>
        </div>
      )}

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Sélection des modèles
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-700">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Comportement d'exécution
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Timeout (secondes)" hint="Durée maximale accordée à une génération avant abandon.">
            <Input
              type="number"
              min="1"
              value={form.timeout_secondes}
              onChange={(e) => setForm((f) => ({ ...f, timeout_secondes: e.target.value }))}
            />
          </Field>
          <Field label="Nombre max d'itérations" hint="Nombre de relances internes autorisées pour l'orchestrateur.">
            <Input
              type="number"
              min="1"
              value={form.max_iterations}
              onChange={(e) => setForm((f) => ({ ...f, max_iterations: e.target.value }))}
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5 dark:border-slate-700">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Alertes de l'agent Analyste
        </h4>
        <Field label="Destinataires des alertes" hint="Emails fixes, 'departement:X', ou 'tous', séparés par des virgules.">
          <Input
            value={form.analyste_destinataires}
            onChange={(e) => setForm((f) => ({ ...f, analyste_destinataires: e.target.value }))}
            placeholder="rh@example.com, departement:IT"
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="cursor-pointer">
          {saveMutation.isPending && <Spinner />}
          Enregistrer
        </Button>
        {saved && (
          <Badge tone="success">Configuration enregistrée</Badge>
        )}
        {saveMutation.isError && (
          <Badge tone="danger">Échec de l'enregistrement</Badge>
        )}
      </div>
    </Card>
  )
}

export default function ConfigurationPage() {
  const help = useHelpBanner('configuration')
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
        onHelp={help.reopen}
        helpVisible={!help.dismissed}
      />

      <HelpBanner dismissed={help.dismissed} onDismiss={help.dismiss} title="À quoi sert cette page ?">
        Réservée à la DRH. Le prompt global sert de secours pour toute règle/tâche sans instruction propre.
        La section "Modèles Ollama par agent" permet de choisir un modèle différent (Analyste, Chat,
        Orchestrateur) — laissez vide pour utiliser le modèle par défaut. Testez la connexion SMTP ici avant
        de configurer une automatisation qui enverra de vrais mails.
      </HelpBanner>

      {configQuery.isLoading ? (
        <Card>
          <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
        </Card>
      ) : (
        <Card className="space-y-5">
          <SectionHeader
            icon={<GearIcon className="h-4.5 w-4.5" />}
            title="Prompt global"
            description="Utilisé comme modèle par défaut pour le rapport quotidien et pour toute règle d'automatisation sans prompt spécifique."
          />

          <Field
            label="Prompt Ollama global"
            hint="Variables disponibles : {{nom}}, {{departement}}, {{date_fin}}, {{jours_restants}}."
          >
            <Textarea
              className="min-h-[220px] font-mono text-[13px] leading-relaxed"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tu es un assistant RH. Rédige..."
            />
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>Utilisé comme modèle par défaut par les automatisations.</span>
              <span className="tabular-nums">{prompt.length} caractère{prompt.length > 1 ? 's' : ''}</span>
            </div>
          </Field>

          <Field label="Heure du rapport quotidien" hint="Heure locale (Africa/Algiers) à laquelle le rapport quotidien est généré et envoyé.">
            <input
              type="time"
              className="w-40 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              onClick={() => saveMutation.mutate({ prompt_global: prompt, heure_rapport_quotidien: heure })}
              disabled={saveMutation.isPending}
              className="cursor-pointer"
            >
              {saveMutation.isPending && <Spinner />}
              Enregistrer
            </Button>
            {saved && <Badge tone="success">Configuration enregistrée</Badge>}
          </div>
        </Card>
      )}

      {saveMutation.isError && (
        <Toast tone="error" message="Échec de l'enregistrement de la configuration." onDismiss={() => {}} />
      )}

      <AgentsConfigCard />

      <Card className="space-y-4">
        <SectionHeader
          icon={<MailIcon className="h-4.5 w-4.5" />}
          title="Connexion SMTP"
          description={
            <>
              Vérifie que les identifiants SMTP dans <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-700">.env</code> fonctionnent, sans envoyer de mail.
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => smtpTestMutation.mutate()}
            disabled={smtpTestMutation.isPending}
            className="cursor-pointer"
          >
            {smtpTestMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <MailIcon className="h-3.5 w-3.5" />}
            Tester la connexion SMTP
          </Button>
          {smtpTestMutation.isPending && (
            <span className="text-sm text-slate-500 dark:text-slate-400">Test en cours…</span>
          )}
          {smtpTestMutation.isSuccess && <Badge tone="success">Connexion OK</Badge>}
          {smtpTestMutation.isError && <Badge tone="danger">Échec du test</Badge>}
        </div>
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
