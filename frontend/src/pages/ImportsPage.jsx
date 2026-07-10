import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchEmployees, fetchImportHistory, uploadExcelImport } from '../lib/api'
import { Badge, Card, EmptyCell, EmptyState, PageHeader, Spinner, Toast, UploadIcon } from '../lib/ui'
import { statusTone } from '../theme'

const STATUS_LABEL = { SUCCESS: 'Succès', FAILED: 'Échec', PENDING: 'En cours' }

export default function ImportsPage() {
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const historyQuery = useQuery({ queryKey: ['imports-history'], queryFn: fetchImportHistory })
  const employeesQuery = useQuery({ queryKey: ['employees'], queryFn: () => fetchEmployees() })

  const uploadMutation = useMutation({
    mutationFn: uploadExcelImport,
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['imports-history'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err) => setError(err?.response?.data?.detail || "Échec de l'import."),
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <PageHeader
        title="Import Excel"
        description="Colonnes attendues : matricule, nom, prenom, email, departement, poste, date_embauche."
      />

      <Card className="flex items-center justify-between border-dashed">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <UploadIcon />
          </div>
          <div>
            <p className="font-medium text-slate-900">Sélectionner un fichier .xlsx</p>
            <p className="text-sm text-slate-500">Les employés sont créés ou mis à jour automatiquement.</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700">
          {uploadMutation.isPending && <Spinner />}
          {uploadMutation.isPending ? 'Import en cours…' : 'Choisir un fichier'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
          />
        </label>
      </Card>

      {error && <Toast tone="error" message={error} onDismiss={() => setError('')} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Historique des imports</h2>
        <Card padded={false}>
          {historyQuery.isLoading ? (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : historyQuery.data?.length === 0 ? (
            <EmptyState title="Aucun import pour le moment" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Importées</th>
                  <th className="px-5 py-3 font-medium">Erreurs</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-500">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[row.status] || 'neutral'}>{STATUS_LABEL[row.status] || row.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.lignes_total}</td>
                    <td className="px-5 py-3 text-slate-700">{row.lignes_importees}</td>
                    <td className="px-5 py-3 text-slate-700">{row.lignes_erreurs || <EmptyCell />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Employés</h2>
        <Card padded={false}>
          {employeesQuery.isLoading ? (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : employeesQuery.data?.length === 0 ? (
            <EmptyState title="Aucun employé importé" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-5 py-3 font-medium">Matricule</th>
                  <th className="px-5 py-3 font-medium">Nom</th>
                  <th className="px-5 py-3 font-medium">Prénom</th>
                  <th className="px-5 py-3 font-medium">Département</th>
                  <th className="px-5 py-3 font-medium">Poste</th>
                </tr>
              </thead>
              <tbody>
                {employeesQuery.data.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-900">{emp.matricule}</td>
                    <td className="px-5 py-3 text-slate-700">{emp.nom}</td>
                    <td className="px-5 py-3 text-slate-700">{emp.prenom}</td>
                    <td className="px-5 py-3 text-slate-700">{emp.departement || <EmptyCell />}</td>
                    <td className="px-5 py-3 text-slate-700">{emp.poste || <EmptyCell />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  )
}
