import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchWorkflowDefinitions,
  fetchWorkflowExecutions,
  lancerWorkflow,
  lancerWorkflowPersonnalise,
  reprendreWorkflow,
} from '../lib/api'
import { describeApiError } from '../lib/errors'
import { useNotifications } from '../lib/useNotifications'
import {
  Badge,
  BoltIcon,
  Button,
  Card,
  CheckCircleIcon,
  EmptyState,
  Field,
  FileTextIcon,
  GridIcon,
  Input,
  PageHeader,
  SparkleIcon,
  Spinner,
  Textarea,
  Toast,
  UsersIcon,
  WorkflowIcon,
} from '../lib/ui'

const ETAPE_TONE = { EN_ATTENTE: 'neutral', EN_COURS: 'warning', TERMINE: 'success', ECHEC: 'danger' }
const STATUT_LABEL = { EN_COURS: 'En cours', TERMINE: 'Terminé', ECHEC: 'Échec' }

const WORKFLOW_META = {
  FIN_DE_MOIS: { icon: GridIcon, description: 'Vérifications et tâches de clôture mensuelle.' },
  ONBOARDING: { icon: UsersIcon, description: "Accueil d'un nouvel employé, étape par étape." },
  AUDIT_CONTRATS: { icon: FileTextIcon, description: 'Analyse des contrats et anomalies détectées.' },
  RAPPORT_HEBDO: { icon: BoltIcon, description: 'Génération et envoi du rapport hebdomadaire.' },
}

function workflowMeta(type_workflow) {
  return WORKFLOW_META[type_workflow] || { icon: WorkflowIcon, description: 'Workflow prédéfini.' }
}

function Stepper({ etapes }) {
  return (
    <ol className="relative">
      {etapes.map((etape, i) => {
        const isLast = i === etapes.length - 1
        const lineDone = etape.statut === 'TERMINE'
        return (
          <li key={i} className="relative flex items-start gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute left-2.75 top-6 h-[calc(100%-1.5rem)] w-px ${
                  lineDone ? 'bg-emerald-400 dark:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            )}
            <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
              {etape.statut === 'EN_COURS' ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 motion-safe:animate-pulse dark:bg-primary-950/60">
                  <Spinner className="h-4 w-4 text-primary-600 dark:text-primary-300" />
                </span>
              ) : etape.statut === 'TERMINE' ? (
                <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              ) : etape.statut === 'ECHEC' ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 ring-2 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800">
                  !
                </span>
              ) : (
                <span className="flex h-6 w-6 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={`text-sm ${
                  etape.statut === 'EN_ATTENTE'
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'font-medium text-slate-700 dark:text-slate-200'
                }`}
              >
                {etape.nom}
              </p>
              {etape.resultat && <p className="text-xs text-slate-400">{etape.resultat}</p>}
              {etape.erreur && (
                <p className="mt-1 inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
                  {etape.erreur}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function ExecutionCard({ execution, onReprendre, isResuming }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
            <WorkflowIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{execution.nom}</p>
            <p className="text-xs text-slate-400">{new Date(execution.created_at).toLocaleString('fr-FR')}</p>
          </div>
        </div>
        <Badge tone={ETAPE_TONE[execution.statut] || 'neutral'}>{STATUT_LABEL[execution.statut] || execution.statut}</Badge>
      </div>

      <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
        <Stepper etapes={execution.etapes} />
      </div>

      {execution.statut === 'ECHEC' && (
        <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
          <Button size="sm" variant="secondary" onClick={() => onReprendre(execution.id)} disabled={isResuming}>
            {isResuming ? <Spinner className="h-3.5 w-3.5" /> : <BoltIcon className="h-3.5 w-3.5" />}
            Reprendre depuis l'étape échouée
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function OrchestrateurPage() {
  const [toast, setToast] = useState(null)
  const [matricule, setMatricule] = useState('')
  const [instruction, setInstruction] = useState('')
  const queryClient = useQueryClient()

  const definitionsQuery = useQuery({ queryKey: ['workflow-definitions'], queryFn: fetchWorkflowDefinitions })
  const executionsQuery = useQuery({ queryKey: ['workflow-executions'], queryFn: fetchWorkflowExecutions })

  useNotifications((payload) => {
    if (payload.type === 'workflow') {
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] })
    }
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workflow-executions'] })

  const lancerMutation = useMutation({
    mutationFn: lancerWorkflow,
    onSuccess: invalidate,
    onError: (err) => setToast({ message: describeApiError(err, 'Échec du lancement du workflow.'), tone: 'error' }),
  })

  const personnaliseMutation = useMutation({
    mutationFn: lancerWorkflowPersonnalise,
    onSuccess: () => {
      invalidate()
      setInstruction('')
      setToast({ message: 'Workflow personnalisé lancé.', tone: 'success' })
    },
    onError: (err) => setToast({ message: describeApiError(err, 'Échec de la planification.'), tone: 'error' }),
  })

  const reprendreMutation = useMutation({
    mutationFn: reprendreWorkflow,
    onSuccess: invalidate,
    onError: (err) => setToast({ message: describeApiError(err, 'Échec de la reprise.'), tone: 'error' }),
  })

  const handleLancer = (type_workflow) => {
    const parametres = type_workflow === 'ONBOARDING' ? { matricule } : {}
    if (type_workflow === 'ONBOARDING' && !matricule) {
      setToast({ message: "Renseignez un matricule pour l'onboarding.", tone: 'error' })
      return
    }
    lancerMutation.mutate({ type_workflow, parametres })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <PageHeader
        title="Orchestrateur de workflows"
        description="Enchaîne automatiquement plusieurs étapes RH en une seule instruction."
      />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workflows prédéfinis</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {definitionsQuery.data?.map((w) => {
            const { icon: Icon, description } = workflowMeta(w.type_workflow)
            return (
              <button
                key={w.type_workflow}
                type="button"
                onClick={() => handleLancer(w.type_workflow)}
                disabled={lancerMutation.isPending}
                className="group flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-(--shadow-raised) focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-primary-700"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100 dark:bg-primary-950/50 dark:text-primary-300 dark:group-hover:bg-primary-900/60">
                  {lancerMutation.isPending && lancerMutation.variables?.type_workflow === w.type_workflow ? (
                    <Spinner className="h-4.5 w-4.5" />
                  ) : (
                    <Icon className="h-4.5 w-4.5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{w.nom}</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>
                </span>
              </button>
            )
          })}
        </div>
        <Field label="Matricule (requis pour Onboarding)">
          <Input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Ex: M100" />
        </Field>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
            <SparkleIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workflow personnalisé (langage naturel)</h2>
        </div>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ex: Vérifie les contrats qui expirent bientôt et génère un rapport."
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            onClick={() => personnaliseMutation.mutate({ instruction })}
            disabled={personnaliseMutation.isPending || !instruction.trim()}
          >
            {personnaliseMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <SparkleIcon className="h-3.5 w-3.5" />}
            Planifier et lancer
          </Button>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Historique des exécutions</h2>
        {executionsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : executionsQuery.data?.length === 0 ? (
          <EmptyState
            title="Aucune exécution pour le moment"
            description="Lancez un workflow prédéfini ou décrivez-en un personnalisé ci-dessus."
          />
        ) : (
          <div className="space-y-3">
            {executionsQuery.data?.map((execution) => (
              <ExecutionCard
                key={execution.id}
                execution={execution}
                onReprendre={(id) => reprendreMutation.mutate(id)}
                isResuming={reprendreMutation.isPending && reprendreMutation.variables === execution.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
