import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { envoyerMail, fetchEmployees, generateMailApercu } from '../lib/api'

export default function MailApercuPage() {
  const [employeeId, setEmployeeId] = useState('')
  const [sujetDemande, setSujetDemande] = useState('')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')

  const employeesQuery = useQuery({
    queryKey: ['employees'],
    queryFn: () => fetchEmployees(),
  })

  const apercuMutation = useMutation({
    mutationFn: generateMailApercu,
  })

  const result = apercuMutation.data

  useEffect(() => {
    if (result?.status === 'DRAFT') {
      setEditedSubject(result.subject)
      setEditedBody(result.body)
    }
  }, [result])

  const envoyerMutation = useMutation({
    mutationFn: envoyerMail,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!employeeId || !sujetDemande) return
    envoyerMutation.reset()
    apercuMutation.mutate({ employeeId, sujetDemande })
  }

  const handleRegenerer = () => {
    if (!employeeId || !sujetDemande) return
    envoyerMutation.reset()
    apercuMutation.mutate({ employeeId, sujetDemande })
  }

  const handleEnvoyer = () => {
    if (!result?.id) return
    envoyerMutation.mutate({ mailLogId: result.id, subject: editedSubject, body: editedBody })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Aperçu mail (IA)</h1>
        <p className="mt-1 text-gray-500">
          Génère un brouillon de mail RH via le modèle Ollama local, à relire et modifier avant envoi.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Employé</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Sujet demandé</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="Ex: rappel de renouvellement de contrat"
            value={sujetDemande}
            onChange={(e) => setSujetDemande(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={apercuMutation.isPending || !employeeId || !sujetDemande}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {apercuMutation.isPending ? 'Génération…' : 'Générer un aperçu'}
        </button>
      </form>

      {apercuMutation.isError && (
        <p className="text-sm text-red-600">
          {apercuMutation.error?.response?.data?.detail || 'Erreur lors de la génération.'}
        </p>
      )}

      {result && result.status === 'FAILED' && (
        <p className="text-sm text-red-600">{result.erreur}</p>
      )}

      {result && result.status === 'DRAFT' && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label className="mb-1 block text-sm text-gray-500">Objet</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-500">Corps</label>
            <textarea
              className="min-h-[180px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleRegenerer}
              disabled={apercuMutation.isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {apercuMutation.isPending ? 'Régénération…' : 'Régénérer via Ollama'}
            </button>
            <button
              onClick={handleEnvoyer}
              disabled={envoyerMutation.isPending}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {envoyerMutation.isPending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
          {envoyerMutation.isSuccess && (
            <p className="text-sm text-emerald-700">
              Statut: {envoyerMutation.data.status === 'SENT' ? 'Envoyé avec succès.' : envoyerMutation.data.status}
            </p>
          )}
          {envoyerMutation.isError && (
            <p className="text-sm text-red-600">
              {envoyerMutation.error?.response?.data?.detail || "Échec de l'envoi."}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
