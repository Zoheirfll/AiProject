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
  Button,
  Card,
  CheckCircleIcon,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  Toast,
  WorkflowIcon,
} from '../lib/ui'

const ETAPE_TONE = { EN_ATTENTE: 'neutral', EN_COURS: 'warning', TERMINE: 'success', ECHEC: 'danger' }
const STATUT_LABEL = { EN_COURS: 'En cours', TERMINE: 'Terminé', ECHEC: 'Échec' }

function Stepper({ etapes }) {
  return (
    <ol className="space-y-2">
      {etapes.map((etape, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
            {etape.statut === 'EN_COURS' ? (
              <Spinner className="h-4 w-4 text-amber-500" />
            ) : etape.statut === 'TERMINE' ? (
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            ) : etape.statut === 'ECHEC' ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600 dark:bg-red-950">!</span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700 dark:text-slate-300">{etape.nom}</p>
            {etape.resultat && <p className="text-xs text-slate-400">{etape.resultat}</p>}
            {etape.erreur && <p className="text-xs text-red-600">{etape.erreur}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function ExecutionCard({ execution, onReprendre, isResuming }) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
            <WorkflowIcon />
          </span>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{execution.nom}</p>
            <p className="text-xs text-slate-400">{new Date(execution.created_at).toLocaleString('fr-FR')}</p>
          </div>
        </div>
        <Badge tone={ETAPE_TONE[execution.statut] || 'neutral'}>{STATUT_LABEL[execution.statut] || execution.statut}</Badge>
      </div>

      <Stepper etapes={execution.etapes} />

      {execution.statut === 'ECHEC' && (
        <Button size="sm" variant="secondary" onClick={() => onReprendre(execution.id)} disabled={isResuming}>
          {isResuming && <Spinner className="h-3.5 w-3.5" />} Reprendre depuis l'étape échouée
        </Button>
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
        <div className="flex flex-wrap gap-2">
          {definitionsQuery.data?.map((w) => (
            <Button
              key={w.type_workflow}
              variant="secondary"
              size="sm"
              onClick={() => handleLancer(w.type_workflow)}
              disabled={lancerMutation.isPending}
            >
              {lancerMutation.isPending && <Spinner className="h-3.5 w-3.5" />} {w.nom}
            </Button>
          ))}
        </div>
        <Field label="Matricule (requis pour Onboarding)">
          <Input value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Ex: M100" />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Workflow personnalisé (langage naturel)</h2>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ex: Vérifie les contrats qui expirent bientôt et génère un rapport."
        />
        <Button
          size="sm"
          onClick={() => personnaliseMutation.mutate({ instruction })}
          disabled={personnaliseMutation.isPending || !instruction.trim()}
        >
          {personnaliseMutation.isPending && <Spinner className="h-3.5 w-3.5" />} Planifier et lancer
        </Button>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Historique des exécutions</h2>
        {executionsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : executionsQuery.data?.length === 0 ? (
          <EmptyState title="Aucune exécution pour le moment" />
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
