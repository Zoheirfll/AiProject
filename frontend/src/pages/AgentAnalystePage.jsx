import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAgentAnalyses, lancerAnalyse } from '../lib/api'
import { describeApiError } from '../lib/errors'
import { Badge, Button, Card, EmptyState, PageHeader, SparkleIcon, Spinner, Toast } from '../lib/ui'

const DECISION_TONE = {
  nouveaux_arrivants: 'primary',
  contrats_critiques: 'danger',
  anomalies: 'warning',
}

export default function AgentAnalystePage() {
  const [toast, setToast] = useState(null)
  const queryClient = useQueryClient()

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
        title="Agent Analyste"
        description="Analyse automatiquement les imports Excel : contrats critiques, anomalies, nouveaux arrivants — et décide s'il faut alerter."
        actions={
          <Button onClick={() => lancerMutation.mutate()} disabled={lancerMutation.isPending}>
            {lancerMutation.isPending ? <Spinner /> : <SparkleIcon />}
            {lancerMutation.isPending ? 'Analyse en cours…' : 'Lancer une analyse'}
          </Button>
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
        <div className="space-y-3">
          {analysesQuery.data?.map((analyse) => (
            <Card key={analyse.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {analyse.fichier_import ? `Import : ${analyse.fichier_import}` : 'Analyse ponctuelle'}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(analyse.created_at).toLocaleString('fr-FR')}</p>
                </div>
                {analyse.alertes_envoyees > 0 && <Badge tone="success">Alerte envoyée</Badge>}
              </div>

              {analyse.decisions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {analyse.decisions.map((d, i) => (
                    <Badge key={i} tone={DECISION_TONE[d.type] || 'neutral'}>{d.description}</Badge>
                  ))}
                </div>
              )}

              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{analyse.resume}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
