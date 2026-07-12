import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTache,
  deleteTache,
  fetchTacheHistorique,
  fetchTaches,
  runTache,
  testTache,
} from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  EyeIcon,
  Field,
  HistoryIcon,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PlusIcon,
  Select,
  Spinner,
  Textarea,
  Toast,
  TrashIcon,
  UploadIcon,
} from '../lib/ui'

const emptyForm = {
  nom: '',
  actif: true,
  fichier: null,
  frequence: 'QUOTIDIEN',
  heure_quotidienne: '09:00',
  prompt_analyse: '',
  mode_envoi: 'ANOMALIE',
  destinataires: '',
  cc: '',
  bcc: '',
}

function toList(value) {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

const FREQUENCE_LABEL = { HORAIRE: 'Toutes les heures', QUOTIDIEN: 'Quotidien' }
const MODE_LABEL = { TOUJOURS: 'Toujours (rapport)', ANOMALIE: 'Si anomalie seulement' }

function TacheFormModal({ open, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState(emptyForm)
  const [dragOver, setDragOver] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.fichier || !form.nom || !form.prompt_analyse) return
    onSubmit({
      nom: form.nom,
      actif: form.actif,
      fichier: form.fichier,
      frequence: form.frequence,
      heure_quotidienne: form.heure_quotidienne,
      prompt_analyse: form.prompt_analyse,
      mode_envoi: form.mode_envoi,
      destinataires: toList(form.destinataires),
      cc: toList(form.cc),
      bcc: toList(form.bcc),
    })
    setForm(emptyForm)
  }

  const setFile = (file) => setForm((f) => ({ ...f, fichier: file || null }))

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle tâche de surveillance">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Informations générales
          </p>
          <Field label="Nom de la tâche">
            <Input
              placeholder="Ex: Surveillance des retards de paiement"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
            />
          </Field>

          <Field label="Document à surveiller" hint="Excel, CSV ou texte — relu à chaque exécution.">
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                setFile(e.dataTransfer.files?.[0])
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-primary-500/40 ${
                dragOver
                  ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-200'
                  : form.fichier
                    ? 'border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/30 dark:text-accent-300'
                    : 'border-slate-300 bg-slate-50 text-slate-600 hover:border-primary-300 hover:bg-primary-50/50 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-primary-500'
              }`}
            >
              <UploadIcon />
              <span>{form.fichier ? form.fichier.name : 'Glissez un fichier ici, ou cliquez pour choisir'}</span>
              {form.fichier && (
                <span className="text-xs font-normal text-accent-600 dark:text-accent-400">
                  Fichier sélectionné — cliquez pour changer
                </span>
              )}
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </label>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fréquence">
              <Select value={form.frequence} onChange={(e) => setForm({ ...form, frequence: e.target.value })}>
                <option value="QUOTIDIEN">Quotidien</option>
                <option value="HORAIRE">Toutes les heures</option>
              </Select>
            </Field>
            {form.frequence === 'QUOTIDIEN' && (
              <Field label="Heure d'exécution">
                <Input
                  type="time"
                  value={form.heure_quotidienne}
                  onChange={(e) => setForm({ ...form, heure_quotidienne: e.target.value })}
                />
              </Field>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-100 pt-5 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Analyse & envoi
          </p>
          <Field label="Consigne d'analyse (pour Ollama)" hint="Ex: signale toute facture en retard de plus de 30 jours.">
            <Textarea
              placeholder="Que doit vérifier Ollama dans ce document ?"
              value={form.prompt_analyse}
              onChange={(e) => setForm({ ...form, prompt_analyse: e.target.value })}
              required
            />
          </Field>

          <Field label="Mode d'envoi">
            <Select value={form.mode_envoi} onChange={(e) => setForm({ ...form, mode_envoi: e.target.value })}>
              <option value="ANOMALIE">Envoyer seulement si Ollama détecte une anomalie</option>
              <option value="TOUJOURS">Toujours envoyer (rapport périodique)</option>
            </Select>
          </Field>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            <span className="font-semibold text-primary-700 dark:text-primary-300">Anomalie</span> : un mail n'est envoyé que
            si Ollama détecte quelque chose à signaler dans le document.{' '}
            <span className="font-semibold text-accent-700 dark:text-accent-300">Toujours</span> : un mail-rapport est envoyé
            à chaque exécution, même sans anomalie.
          </div>

          <Field label="Destinataires" hint="Emails fixes, 'departement:NomDuDept', ou 'tous'.">
            <Input
              placeholder="rh@example.com, departement:IT, tous"
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

          <Checkbox
            label="Tâche active"
            checked={form.actif}
            onChange={(e) => setForm({ ...form, actif: e.target.checked })}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending || !form.nom || !form.fichier}>
            {isPending && <Spinner />} {isPending ? 'Création…' : 'Créer la tâche'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function HistoriqueModal({ tache, onClose }) {
  const historyQuery = useQuery({
    queryKey: ['surveillance-historique', tache?.id],
    queryFn: () => fetchTacheHistorique(tache.id),
    enabled: !!tache,
  })

  return (
    <Modal open={!!tache} onClose={onClose} title={`Historique — ${tache?.nom || ''}`}>
      {historyQuery.isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Spinner /> Chargement…</div>
      )}
      {!historyQuery.isLoading && historyQuery.data?.length === 0 && (
        <EmptyState
          title="Aucune exécution pour le moment"
          description="L'historique apparaîtra ici après la première exécution planifiée ou manuelle de cette tâche."
        />
      )}
      {!historyQuery.isLoading && historyQuery.data?.length > 0 && (
        <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
          {historyQuery.data.map((exec) => (
            <div
              key={exec.id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={exec.envoye ? 'success' : 'neutral'}>{exec.envoye ? 'Mail envoyé' : 'Sans envoi'}</Badge>
                <span className="text-xs text-slate-400">{new Date(exec.executed_at).toLocaleString('fr-FR')}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{exec.resume}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

function TacheCard({ tache, onRun, onTest, onDelete, onVoirHistorique, isRunning, isTesting, isDrh }) {
  const handleDelete = () => {
    if (window.confirm(`Supprimer définitivement la tâche « ${tache.nom} » ? Cette action est irréversible.`)) {
      onDelete()
    }
  }

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
          <EyeIcon />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{tache.nom}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={tache.actif ? 'success' : 'neutral'}>{tache.actif ? 'Active' : 'Inactive'}</Badge>
            <Badge tone="primary">{FREQUENCE_LABEL[tache.frequence]}{tache.frequence === 'QUOTIDIEN' && ` · ${tache.heure_quotidienne?.slice(0, 5)}`}</Badge>
            <Badge tone={tache.mode_envoi === 'TOUJOURS' ? 'warning' : 'neutral'}>{MODE_LABEL[tache.mode_envoi]}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-sm text-slate-500 dark:text-slate-400">
        <p className="truncate">
          <span className="font-medium text-slate-600 dark:text-slate-300">Destinataires :</span>{' '}
          {tache.destinataires?.join(', ') || 'aucun'}
        </p>
        {isDrh && tache.cree_par_username && (
          <p className="text-xs text-slate-400">Créée par : {tache.cree_par_username}</p>
        )}
        <p className="text-xs text-slate-400">
          Dernière exécution : {tache.derniere_execution ? new Date(tache.derniere_execution).toLocaleString('fr-FR') : 'jamais'}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="cursor-pointer" onClick={onRun} disabled={isRunning}>
            {isRunning && <Spinner className="h-3.5 w-3.5" />} Exécuter
          </Button>
          <Button variant="secondary" size="sm" className="cursor-pointer" onClick={onTest} disabled={isTesting}>
            {isTesting && <Spinner className="h-3.5 w-3.5" />} Tester
          </Button>
          <IconButton label="Historique" onClick={onVoirHistorique} className="cursor-pointer">
            <HistoryIcon />
          </IconButton>
        </div>
        {isDrh && (
          <Button variant="danger" size="sm" className="cursor-pointer" onClick={handleDelete} aria-label="Supprimer la tâche">
            <TrashIcon /> Supprimer
          </Button>
        )}
      </div>
    </Card>
  )
}

export default function SurveillancePage() {
  const { isDrh } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [historiqueTache, setHistoriqueTache] = useState(null)
  const queryClient = useQueryClient()

  const tachesQuery = useQuery({ queryKey: ['taches-surveillance'], queryFn: fetchTaches })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['taches-surveillance'] })

  const createMutation = useMutation({
    mutationFn: createTache,
    onSuccess: () => {
      setModalOpen(false)
      invalidate()
      setToast({ message: 'Tâche créée avec succès.', tone: 'success' })
    },
    onError: () => setToast({ message: 'Échec de la création de la tâche.', tone: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTache,
    onSuccess: () => {
      invalidate()
      setToast({ message: 'Tâche supprimée.', tone: 'success' })
    },
  })

  const runMutation = useMutation({
    mutationFn: (id) => {
      setActiveId(id)
      return runTache(id)
    },
    onSuccess: (data) => {
      invalidate()
      setToast({
        message: data.envoye ? 'Exécution terminée — un mail a été envoyé.' : 'Exécution terminée — rien à signaler.',
        tone: 'success',
      })
    },
    onError: () => setToast({ message: "Échec de l'exécution.", tone: 'error' }),
    onSettled: () => setActiveId(null),
  })

  const testMutation = useMutation({
    mutationFn: (id) => {
      setActiveId(id)
      return testTache(id)
    },
    onSuccess: (data) =>
      setToast({
        message: data.envoye ? 'Test: un mail aurait été envoyé.' : 'Test: aucune anomalie détectée.',
        tone: 'success',
      }),
    onError: () => setToast({ message: 'Échec du test.', tone: 'error' }),
    onSettled: () => setActiveId(null),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Surveillance de documents"
        description="Surveille un fichier à intervalle régulier, fait analyser son contenu par Ollama, et envoie un mail si nécessaire."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <PlusIcon /> Nouvelle tâche
          </Button>
        }
      />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      <TacheFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
      />

      <HistoriqueModal tache={historiqueTache} onClose={() => setHistoriqueTache(null)} />

      {tachesQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Chargement…
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tachesQuery.data?.map((tache) => (
          <TacheCard
            key={tache.id}
            tache={tache}
            onRun={() => runMutation.mutate(tache.id)}
            onTest={() => testMutation.mutate(tache.id)}
            onDelete={() => deleteMutation.mutate(tache.id)}
            onVoirHistorique={() => setHistoriqueTache(tache)}
            isRunning={runMutation.isPending && activeId === tache.id}
            isTesting={testMutation.isPending && activeId === tache.id}
            isDrh={isDrh}
          />
        ))}

        {tachesQuery.data?.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title="Aucune tâche de surveillance configurée"
              description="Ajoutez un document à surveiller (Excel, CSV, texte) pour que Ollama l'analyse automatiquement."
              action={
                <Button variant="secondary" onClick={() => setModalOpen(true)}>
                  <PlusIcon /> Nouvelle tâche
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
