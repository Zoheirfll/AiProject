import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAgentAnalyses, lancerAnalyse } from '../lib/api'
import { describeApiError } from '../lib/errors'
import { useAuth } from '../lib/AuthContext'
import { Badge, Button, Card, EmptyState, PageHeader, SparkleIcon, Spinner, Toast } from '../lib/ui'

const DECISION_TONE = {
  anomalies: 'danger',
  donnees_analysees: 'neutral',
}

export default function AgentAnalystePage() {
  const [toast, setToast] = useState(null)
  const queryClient = useQueryClient()
  const { isDrh } = useAuth()

  const analysesQuery = useQuery({ queryKey: ['agent-analyses'], queryFn: fetchAgentAnalyses })

  const lancerMutation = useMutation({
    mutationFn: lancerAnalyse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-analyses'] })
      setToast({ message: 'Analyse effectuée.', tone: 'success' })
    },
    onError: (err) => setToast({ message: describeApiError(err, "Échec de l'analyse."), tone: 'error' }),
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-r from-accent-500 to-accent-600 text-white shadow-[var(--shadow-card)]">
              <SparkleIcon className="h-4 w-4" />
            </span>
            Agent Analyste
          </span>
        }
        description="Analyse automatiquement chaque import Excel, quel que soit son contenu (contrats, congés, formations…), et décide s'il faut alerter l'équipe RH."
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button
              onClick={() => lancerMutation.mutate()}
              disabled={lancerMutation.isPending}
              className="cursor-pointer disabled:cursor-not-allowed"
            >
              {lancerMutation.isPending ? <Spinner className="h-4 w-4" /> : <SparkleIcon className="h-4 w-4" />}
              {lancerMutation.isPending ? 'Analyse en cours…' : 'Lancer une analyse'}
            </Button>
            {lancerMutation.isPending && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                L'analyse peut prendre quelques secondes.
              </p>
            )}
          </div>
        }
      />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      {analysesQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
      ) : analysesQuery.data?.length === 0 ? (
        <EmptyState
          title="Aucune analyse pour le moment"
          description="L'agent s'exécute automatiquement après chaque import Excel, ou lancez une analyse ponctuelle ci-dessus."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {analysesQuery.data?.map((analyse) => (
            <Card
              key={analyse.id}
              className="space-y-4 border-l-4 border-l-accent-500 dark:border-l-accent-600"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {analyse.fichier_import ? `Import : ${analyse.fichier_import}` : 'Analyse ponctuelle'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {new Date(analyse.created_at).toLocaleString('fr-FR')}
                    {isDrh && analyse.cree_par_username && ` · Lancée par ${analyse.cree_par_username}`}
                  </p>
                </div>
                {analyse.alertes_envoyees > 0 ? (
                  <Badge tone="success">Alerte envoyée</Badge>
                ) : (
                  <Badge tone="neutral">Aucune alerte</Badge>
                )}
              </div>

              {analyse.resume && (
                <blockquote className="relative rounded-lg border border-accent-100 bg-accent-50/60 py-3 pl-4 pr-3 text-sm text-slate-700 dark:border-accent-700/40 dark:bg-accent-500/10 dark:text-slate-200">
                  <SparkleIcon className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-white p-0.5 text-accent-600 shadow-[var(--shadow-card)] dark:bg-slate-900 dark:text-accent-400" />
                  <p className="whitespace-pre-wrap leading-relaxed">{analyse.resume}</p>
                </blockquote>
              )}

              {analyse.decisions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {analyse.decisions.map((d, i) => (
                    <Badge key={i} tone={DECISION_TONE[d.type] || 'neutral'}>{d.description}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
