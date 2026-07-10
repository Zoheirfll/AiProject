import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchMailHistorique, testerSmtp } from '../lib/api'
import { Badge, Button, Card, CheckCircleIcon, EmptyCell, EmptyState, PageHeader, Spinner, Toast } from '../lib/ui'
import { statusTone } from '../theme'

const STATUS_LABEL = { SENT: 'Envoyé', FAILED: 'Échec', DRAFT: 'Brouillon' }

const FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'SENT', label: 'Envoyé' },
  { value: 'FAILED', label: 'Échec' },
  { value: 'DRAFT', label: 'Brouillon' },
]

export default function MailsHistoriquePage() {
  const [statut, setStatut] = useState('')

  const historyQuery = useQuery({
    queryKey: ['mails-historique', statut],
    queryFn: () => fetchMailHistorique(statut ? { statut } : {}),
  })

  const smtpTestMutation = useMutation({ mutationFn: testerSmtp })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Historique des mails"
        description="Envois automatiques (règles) et manuels (aperçu)."
        actions={
          <Button variant="secondary" onClick={() => smtpTestMutation.mutate()} disabled={smtpTestMutation.isPending}>
            {smtpTestMutation.isPending && <Spinner className="h-3.5 w-3.5" />}
            Tester la connexion SMTP
          </Button>
        }
      />

      {smtpTestMutation.isSuccess && (
        <Toast tone="success" message="Connexion SMTP OK." onDismiss={() => smtpTestMutation.reset()} />
      )}
      {smtpTestMutation.isError && (
        <Toast
          tone="error"
          message={smtpTestMutation.error?.response?.data?.detail || 'Échec du test SMTP.'}
          onDismiss={() => smtpTestMutation.reset()}
        />
      )}

      <div className="flex gap-2">
        {FILTERS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatut(opt.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              statut === opt.value
                ? 'bg-primary-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {historyQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400">
            <Spinner /> Chargement…
          </div>
        ) : historyQuery.data?.length === 0 ? (
          <div className="p-2">
            <EmptyState title="Aucun mail pour le moment" description="Les envois automatiques et manuels apparaîtront ici." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Sujet</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {historyQuery.data?.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3 text-slate-500">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                  <td className="px-5 py-3 font-medium text-slate-900">{row.subject || row.sujet_demande}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone[row.status] || 'neutral'}>
                      {row.status === 'SENT' && <CheckCircleIcon className="h-3 w-3" />}
                      {STATUS_LABEL[row.status] || row.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-red-600">{row.erreur || <EmptyCell />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
