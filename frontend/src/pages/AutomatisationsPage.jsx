import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createRegle, deleteRegle, fetchRegles, runRegle, testRegle } from '../lib/api'
import {
  Badge,
  BoltIcon,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PlusIcon,
  Spinner,
  Textarea,
  Toast,
  TrashIcon,
} from '../lib/ui'

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
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

function RuleFormModal({ open, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState(emptyForm)

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
    <Modal open={open} onClose={onClose} title="Nouvelle règle d'automatisation">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nom de la règle">
          <Input
            placeholder="Ex: Alerte contrats CDD"
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Délais d'alerte (jours)" hint="Séparés par des virgules.">
            <Input
              placeholder="45, 20, 7"
              value={form.delais_jours}
              onChange={(e) => setForm({ ...form, delais_jours: e.target.value })}
            />
          </Field>
          <Field label="Départements filtrés">
            <Input
              placeholder="IT, RH (vide = tous)"
              value={form.departements_filtre}
              onChange={(e) => setForm({ ...form, departements_filtre: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Destinataires" hint="Emails fixes ou alias departement:NomDuDept.">
          <Input
            placeholder="rh@example.com, departement:IT"
            value={form.destinataires}
            onChange={(e) => setForm({ ...form, destinataires: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="CC">
            <Input value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
          </Field>
          <Field label="BCC">
            <Input value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} />
          </Field>
        </div>

        <Field label="Prompt personnalisé (optionnel)">
          <Textarea
            placeholder="Variables: {{nom}} {{departement}} {{date_fin}} {{jours_restants}}"
            value={form.prompt_override}
            onChange={(e) => setForm({ ...form, prompt_override: e.target.value })}
          />
        </Field>

        <Checkbox
          label="Règle active"
          checked={form.actif}
          onChange={(e) => setForm({ ...form, actif: e.target.checked })}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending || !form.nom}>
            {isPending && <Spinner />} {isPending ? 'Création…' : 'Créer la règle'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RuleCard({ regle, onRun, onTest, onDelete, isRunning, isTesting }) {
  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <BoltIcon />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{regle.nom}</h3>
            <Badge tone={regle.actif ? 'success' : 'neutral'}>{regle.actif ? 'Active' : 'Inactive'}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Délais: {regle.delais_jours.join(', ') || '—'} jour(s)
            {regle.departements_filtre?.length > 0 && <> · Départements: {regle.departements_filtre.join(', ')}</>}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Destinataires: {regle.destinataires?.join(', ') || 'aucun'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="secondary" size="sm" onClick={onRun} disabled={isRunning}>
          {isRunning && <Spinner className="h-3.5 w-3.5" />} Exécuter
        </Button>
        <Button variant="secondary" size="sm" onClick={onTest} disabled={isTesting}>
          {isTesting && <Spinner className="h-3.5 w-3.5" />} Tester
        </Button>
        <IconButton label="Supprimer" onClick={onDelete} className="hover:bg-red-50 hover:text-red-600">
          <TrashIcon />
        </IconButton>
      </div>
    </Card>
  )
}

export default function AutomatisationsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeId, setActiveId] = useState(null)
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
    mutationFn: (id) => {
      setActiveId(id)
      return runRegle(id)
    },
    onSuccess: (data) =>
      setToast({ message: `Exécution terminée — ${data.length} alerte(s) envoyée(s).`, tone: 'success' }),
    onError: () => setToast({ message: "Échec de l'exécution de la règle.", tone: 'error' }),
    onSettled: () => setActiveId(null),
  })

  const testMutation = useMutation({
    mutationFn: (id) => {
      setActiveId(id)
      return testRegle(id)
    },
    onSuccess: (data) =>
      setToast({ message: `Test envoyé — statut: ${data.status === 'SENT' ? 'Envoyé' : data.status}.`, tone: 'success' }),
    onError: (err) => setToast({ message: err?.response?.data?.detail || 'Échec du test.', tone: 'error' }),
    onSettled: () => setActiveId(null),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Automatisations"
        description="Règles d'alerte de contrats expirants — envoi automatique quotidien à 9h."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <PlusIcon /> Nouvelle règle
          </Button>
        }
      />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      <RuleFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
      />

      {reglesQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Chargement…
        </div>
      )}

      <div className="grid gap-3">
        {reglesQuery.data?.map((regle) => (
          <RuleCard
            key={regle.id}
            regle={regle}
            onRun={() => runMutation.mutate(regle.id)}
            onTest={() => testMutation.mutate(regle.id)}
            onDelete={() => deleteMutation.mutate(regle.id)}
            isRunning={runMutation.isPending && activeId === regle.id}
            isTesting={testMutation.isPending && activeId === regle.id}
          />
        ))}

        {reglesQuery.data?.length === 0 && (
          <EmptyState
            title="Aucune règle configurée"
            description="Créez une règle pour automatiser les alertes de contrats expirants."
            action={
              <Button variant="secondary" onClick={() => setModalOpen(true)}>
                <PlusIcon /> Nouvelle règle
              </Button>
            }
          />
        )}
      </div>
    </div>
  )
}
