import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchEmployees, generateMailApercu } from '../lib/api'

export default function MailApercuPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [sujetDemande, setSujetDemande] = useState('')

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetchEmployees(),
  })

  const apercuMutation = useMutation({
    mutationFn: generateMailApercu,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!employeeId || !sujetDemande) return
    apercuMutation.mutate({ employeeId, sujetDemande })
  }

  const result = apercuMutation.data

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Aperçu mail (IA)</h1>
        <p className="text-gray-500 mt-1">
          Génère un brouillon de mail RH via le modèle Ollama local, à relire avant envoi.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employé</label>
          <select
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Sélectionner…</option>
            {employeesQuery.data?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.prenom} {emp.nom} — {emp.matricule}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sujet demandé</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            placeholder="Ex: rappel de renouvellement de contrat"
            value={sujetDemande}
            onChange={(e) => setSujetDemande(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={apercuMutation.isPending || !employeeId || !sujetDemande}
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {apercuMutation.isPending ? 'Génération…' : 'Générer un aperçu'}
        </button>
      </form>

      {apercuMutation.isError && (
        <p className="text-red-600 text-sm">
          {apercuMutation.error?.response?.data?.detail || 'Erreur lors de la génération.'}
        </p>
      )}

      {result && result.status === 'FAILED' && (
        <p className="text-red-600 text-sm">{result.erreur}</p>
      )}

      {result && result.status === 'DRAFT' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-2">
          <p className="text-sm text-gray-500">Objet</p>
          <p className="font-medium text-gray-900">{result.subject}</p>
          <p className="text-sm text-gray-500 mt-3">Corps</p>
          <p className="whitespace-pre-wrap text-gray-800">{result.body}</p>
        </div>
      )}
    </div>
  )
}
