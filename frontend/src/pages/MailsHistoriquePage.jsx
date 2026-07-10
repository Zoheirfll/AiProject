import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchMailHistorique, testerSmtp } from '../lib/api'

function StatusBadge({ status }) {
  const styles = {
    SENT: 'bg-emerald-100 text-emerald-700',
    FAILED: 'bg-red-100 text-red-700',
    DRAFT: 'bg-yellow-100 text-yellow-700',
  }
  const labels = { SENT: 'Envoyé', FAILED: 'Échec', DRAFT: 'Brouillon' }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function MailsHistoriquePage() {
  const [statut, setStatut] = useState('')

  const historyQuery = useQuery({
    queryKey: ['mails-historique', statut],
    queryFn: () => fetchMailHistorique(statut ? { statut } : {}),
  })

  const smtpTestMutation = useMutation({ mutationFn: testerSmtp })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Historique des mails</h1>
          <p className="mt-1 text-gray-500">Envois automatiques (règles) et manuels (aperçu).</p>
        </div>
        <button
          onClick={() => smtpTestMutation.mutate()}
          disabled={smtpTestMutation.isPending}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {smtpTestMutation.isPending ? 'Test en cours…' : 'Tester la connexion SMTP'}
        </button>
      </div>

      {smtpTestMutation.isSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Connexion SMTP OK.
        </div>
      )}
      {smtpTestMutation.isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {smtpTestMutation.error?.response?.data?.detail || 'Échec du test SMTP.'}
        </div>
      )}

      <div className="flex gap-2">
        {[
          { value: '', label: 'Tous' },
          { value: 'SENT', label: 'Envoyé' },
          { value: 'FAILED', label: 'Échec' },
          { value: 'DRAFT', label: 'Brouillon' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatut(opt.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              statut === opt.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Sujet</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Erreur</th>
            </tr>
          </thead>
          <tbody>
            {historyQuery.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Chargement…</td>
              </tr>
            )}
            {historyQuery.data?.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 text-gray-600">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-gray-900">{row.subject || row.sujet_demande}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3 text-red-600">{row.erreur}</td>
              </tr>
            ))}
            {historyQuery.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Aucun mail pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
