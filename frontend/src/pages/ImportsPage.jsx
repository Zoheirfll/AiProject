import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchEmployees, fetchImportHistory, uploadExcelImport } from '../lib/api'

function StatusBadge({ status }) {
  const styles = {
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || ''}`}>
      {status}
    </span>
  )
}

export default function ImportsPage() {
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const historyQuery = useQuery({
    queryKey: ['imports-history'],
    queryFn: fetchImportHistory,
  })

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetchEmployees(),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadExcelImport,
    onSuccess: () => {
      setError('')
      queryClient.invalidateQueries({ queryKey: ['imports-history'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err) => {
      setError(err?.response?.data?.detail || 'Échec de l\'import.')
    },
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Import Excel</h1>
        <p className="text-gray-500 mt-1">
          Importer la liste des employés depuis un fichier Excel (colonnes : matricule, nom, prenom, email, departement, poste, date_embauche).
        </p>
      </div>

      <div className="border border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">Sélectionner un fichier .xlsx</p>
          <p className="text-sm text-gray-500">Le fichier sera analysé et les employés créés/mis à jour automatiquement.</p>
        </div>
        <label className="cursor-pointer bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
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
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Historique des imports</h2>
        {historyQuery.isLoading && <p className="text-gray-500">Chargement…</p>}
        {historyQuery.data && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Statut</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Importées</th>
                <th className="py-2 pr-4">Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {historyQuery.data.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                  <td className="py-2 pr-4"><StatusBadge status={row.status} /></td>
                  <td className="py-2 pr-4">{row.lignes_total}</td>
                  <td className="py-2 pr-4">{row.lignes_importees}</td>
                  <td className="py-2 pr-4">{row.lignes_erreurs}</td>
                </tr>
              ))}
              {historyQuery.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-400 text-center">Aucun import pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Employés</h2>
        {employeesQuery.isLoading && <p className="text-gray-500">Chargement…</p>}
        {employeesQuery.data && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Matricule</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Prénom</th>
                <th className="py-2 pr-4">Département</th>
                <th className="py-2 pr-4">Poste</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.data.map((emp) => (
                <tr key={emp.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{emp.matricule}</td>
                  <td className="py-2 pr-4">{emp.nom}</td>
                  <td className="py-2 pr-4">{emp.prenom}</td>
                  <td className="py-2 pr-4">{emp.departement}</td>
                  <td className="py-2 pr-4">{emp.poste}</td>
                </tr>
              ))}
              {employeesQuery.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-400 text-center">Aucun employé importé.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
