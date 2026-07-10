import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRegle,
  deleteRegle,
  fetchRegles,
  runRegle,
  testRegle,
} from '../lib/api'

const emptyForm = {
  nom: '',
  actif: true,
  delais_jours: '45, 20, 7',
  departements_filtre: '',
  destinataires: '',
  cc: '',
  bcc: '',
  prompt_override: '',
}

function toList(value) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function Toast({ message, tone = 'success', onDismiss }) {
  if (!message) return null
  const tones = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="text-current/60 hover:text-current">✕</button>
    </div>
  )
}

function RuleFormModal({ open, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState(emptyForm)

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      nom: form.nom,
      actif: form.actif,
      delais_jours: toList(form.delais_jours).map(Number).filter((n) => !Number.isNaN(n)),
      departements_filtre: toList(form.departements_filtre),
      destinataires: toList(form.destinataires),
      cc: toList(form.cc),
      bcc: toList(form.bcc),
      prompt_override: form.prompt_override,
    })
    setForm(emptyForm)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle règle d'automatisation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fermer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nom de la règle</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="Ex: Alerte contrats CDD"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Délais d'alerte (jours avant expiration)
              </label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                placeholder="45, 20, 7"
                value={form.delais_jours}
                onChange={(e) => setForm({ ...form, delais_jours: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-400">Séparés par des virgules.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Départements filtrés</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                placeholder="IT, RH (vide = tous)"
                value={form.departements_filtre}
                onChange={(e) => setForm({ ...form, departements_filtre: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Destinataires</label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="rh@example.com, departement:IT"
              value={form.destinataires}
              onChange={(e) => setForm({ ...form, destinataires: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">
              Emails fixes ou alias <code className="rounded bg-gray-100 px-1">departement:NomDuDept</code>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">CC</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={form.cc}
                onChange={(e) => setForm({ ...form, cc: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">BCC</label>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                value={form.bcc}
                onChange={(e) => setForm({ ...form, bcc: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Prompt personnalisé (optionnel)</label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="Variables disponibles: {{nom}} {{departement}} {{date_fin}} {{jours_restants}}"
              value={form.prompt_override}
              onChange={(e) => setForm({ ...form, prompt_override: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.actif}
              onChange={(e) => setForm({ ...form, actif: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Règle active
          </label>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending || !form.nom}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? 'Création…' : 'Créer la règle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AutomatisationsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const queryClient = useQueryClient()

  const reglesQuery = useQuery({ queryKey: ['regles'], queryFn: fetchRegles })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['regles'] })

  const createMutation = useMutation({
    mutationFn: createRegle,
    onSuccess: () => {
      setModalOpen(false)
      invalidate()
      setToast({ message: 'Règle créée avec succès.', tone: 'success' })
    },
    onError: () => setToast({ message: 'Échec de la création de la règle.', tone: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteRegle,
    onSuccess: () => {
      invalidate()
      setToast({ message: 'Règle supprimée.', tone: 'success' })
    },
  })

  const runMutation = useMutation({
    mutationFn: runRegle,
    onSuccess: (data) =>
      setToast({ message: `Exécution terminée — ${data.length} alerte(s) envoyée(s).`, tone: 'success' }),
    onError: () => setToast({ message: "Échec de l'exécution de la règle.", tone: 'error' }),
  })

  const testMutation = useMutation({
    mutationFn: testRegle,
    onSuccess: (data) =>
      setToast({ message: `Test envoyé — statut: ${data.status === 'SENT' ? 'Envoyé' : data.status}.`, tone: 'success' }),
    onError: (err) =>
      setToast({ message: err?.response?.data?.detail || 'Échec du test.', tone: 'error' }),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Automatisations</h1>
          <p className="mt-1 text-gray-500">
            Règles d'alerte de contrats expirants — envoi automatique quotidien à 9h.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Nouvelle règle
        </button>
      </div>

      <Toast {...toast} onDismiss={() => setToast(null)} />

      <RuleFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
      />

      {reglesQuery.isLoading && <p className="text-gray-500">Chargement…</p>}

      <div className="grid gap-4">
        {reglesQuery.data?.map((regle) => (
          <div key={regle.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{regle.nom}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      regle.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {regle.actif ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Délais: {regle.delais_jours.join(', ') || '—'} jour(s)
                  {regle.departements_filtre?.length > 0 && (
                    <> · Départements: {regle.departements_filtre.join(', ')}</>
                  )}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Destinataires: {regle.destinataires?.join(', ') || 'aucun'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => runMutation.mutate(regle.id)}
                  disabled={runMutation.isPending}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Exécuter
                </button>
                <button
                  onClick={() => testMutation.mutate(regle.id)}
                  disabled={testMutation.isPending}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Tester
                </button>
                <button
                  onClick={() => deleteMutation.mutate(regle.id)}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}

        {reglesQuery.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-400">
            Aucune règle configurée — cliquez sur "Nouvelle règle" pour commencer.
          </div>
        )}
      </div>
    </div>
  )
}
