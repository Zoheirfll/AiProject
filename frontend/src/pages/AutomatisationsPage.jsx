import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthContext'
import { describeApiError } from '../lib/errors'
import {
  createRegle,
  deleteRegle,
  fetchRegleApercu,
  fetchRegleHistorique,
  fetchRegles,
  runRegle,
  testRegle,
  updateRegle,
} from '../lib/api'
import {
  Badge,
  BoltIcon,
  Button,
  Card,
  Checkbox,
  EditIcon,
  EmptyState,
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
  format: 'TEXTE',
}

function toList(value) {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

function regleToForm(regle) {
  return {
    nom: regle.nom,
    actif: regle.actif,
    delais_jours: regle.delais_jours.join(', '),
    departements_filtre: (regle.departements_filtre || []).join(', '),
    destinataires: (regle.destinataires || []).join(', '),
    cc: (regle.cc || []).join(', '),
    bcc: (regle.bcc || []).join(', '),
    prompt_override: regle.prompt_override || '',
    format: regle.format || 'TEXTE',
  }
}

function RuleFormModal({ open, onClose, onSubmit, isPending, editingRegle }) {
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (open) setForm(editingRegle ? regleToForm(editingRegle) : emptyForm)
  }, [open, editingRegle])

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
      format: form.format,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={editingRegle ? `Modifier "${editingRegle.nom}"` : "Nouvelle règle d'automatisation"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Identité de la règle
          </h4>
          <Field label="Nom de la règle">
            <Input
              placeholder="Ex: Alerte contrats CDD"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
            />
          </Field>
          <Checkbox
            label="Règle active"
            checked={form.actif}
            onChange={(e) => setForm({ ...form, actif: e.target.checked })}
          />
        </div>

        <div className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Déclenchement
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>

        <div className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Destinataires
          </h4>
          <Field label="Destinataires" hint="Emails fixes ou alias departement:NomDuDept.">
            <Input
              placeholder="rh@example.com, departement:IT"
              value={form.destinataires}
              onChange={(e) => setForm({ ...form, destinataires: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CC">
              <Input value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
            </Field>
            <Field label="BCC">
              <Input value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Contenu du mail
          </h4>
          <Field label="Prompt personnalisé (optionnel)">
            <Textarea
              placeholder="Variables: {{nom}} {{departement}} {{date_fin}} {{jours_restants}}"
              value={form.prompt_override}
              onChange={(e) => setForm({ ...form, prompt_override: e.target.value })}
            />
          </Field>

          <Field label="Format du mail" hint="HTML génère un email mis en forme (couleurs, titres) au lieu de texte brut.">
            <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              <option value="TEXTE">Texte brut</option>
              <option value="HTML">HTML riche</option>
            </Select>
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending || !form.nom}>
            {isPending && <Spinner />}
            {isPending ? (editingRegle ? 'Enregistrement…' : 'Création…') : (editingRegle ? 'Enregistrer' : 'Créer la règle')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ApercuModal({ regleId, onClose }) {
  const apercuQuery = useQuery({
    queryKey: ['regle-apercu', regleId],
    queryFn: () => fetchRegleApercu(regleId),
    enabled: regleId != null,
  })

  return (
    <Modal open={regleId != null} onClose={onClose} title="Aperçu avant activation">
      {apercuQuery.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Spinner /> Chargement…</div>
      ) : (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Employés concernés
              <Badge tone="primary">{apercuQuery.data?.employes_concernes?.length || 0}</Badge>
            </h4>
            {apercuQuery.data?.employes_concernes?.length ? (
              <ul className="space-y-1.5 text-sm">
                {apercuQuery.data.employes_concernes.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {e.nom} — {e.departement || 'N/A'} — J-{e.jours_restants} ({e.date_fin})
                    </span>
                    {e.deja_envoye && <Badge tone="neutral">déjà alerté</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Aucun employé concerné pour le moment.
              </p>
            )}
          </div>
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Destinataires résolus
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {apercuQuery.data?.destinataires_resolus?.join(', ') || 'aucun'}
            </p>
          </div>
          {apercuQuery.data?.prompt_rendu && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Prompt rendu (1er cas)
              </h4>
              <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {apercuQuery.data.prompt_rendu}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function HistoriqueModal({ regleId, onClose }) {
  const historiqueQuery = useQuery({
    queryKey: ['regle-historique', regleId],
    queryFn: () => fetchRegleHistorique(regleId),
    enabled: regleId != null,
  })

  return (
    <Modal open={regleId != null} onClose={onClose} title="Historique des déclenchements">
      {historiqueQuery.isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Spinner /> Chargement…</div>
      ) : historiqueQuery.data?.length === 0 ? (
        <EmptyState
          title="Aucun déclenchement"
          description="Cette règle n'a encore envoyé aucune alerte."
        />
      ) : (
        <ul className="max-h-96 space-y-1.5 overflow-y-auto text-sm">
          {historiqueQuery.data?.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-0.5 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800/60"
            >
              <span className="text-slate-700 dark:text-slate-300">
                {a.employee_nom} — J-{a.delai_jours} ({a.date_fin})
              </span>
              <span className="text-xs text-slate-400">{new Date(a.date_envoi).toLocaleString('fr-FR')}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function TestModal({ regle, onClose, onConfirm, isPending }) {
  const [testEmail, setTestEmail] = useState('')

  if (!regle) return null

  return (
    <Modal open={!!regle} onClose={onClose} title={`Tester "${regle.nom}"`}>
      <div className="space-y-4">
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
          Génère et envoie un mail de test (sans marquer d'alerte comme envoyée). Laissez vide pour utiliser les
          destinataires réels de la règle.
        </p>
        <Field label="Adresse de test (optionnel)">
          <Input
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onConfirm(testEmail)} disabled={isPending}>
            {isPending && <Spinner />} Envoyer le test
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RuleCard({ regle, onRun, onOpenTest, onOpenApercu, onOpenHistorique, onEdit, onDelete, isRunning, isDrh }) {
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            regle.actif
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
          }`}
        >
          <BoltIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900 dark:text-slate-50">{regle.nom}</h3>
            <Badge tone={regle.actif ? 'success' : 'neutral'}>{regle.actif ? 'Active' : 'Inactive'}</Badge>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral">Délais: {regle.delais_jours.join(', ') || '—'} j</Badge>
            {regle.departements_filtre?.length > 0 ? (
              <Badge tone="neutral">{regle.departements_filtre.join(', ')}</Badge>
            ) : (
              <Badge tone="neutral">Tous départements</Badge>
            )}
            <Badge tone="primary">{regle.destinataires?.length || 0} destinataire(s)</Badge>
          </div>

          {isDrh && regle.cree_par_username && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Créée par {regle.cree_par_username}</p>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onOpenApercu}>Aperçu</Button>
          <Button variant="secondary" size="sm" onClick={onOpenHistorique}>
            <HistoryIcon className="h-3.5 w-3.5" /> Historique
          </Button>
          <Button variant="secondary" size="sm" onClick={onOpenTest}>Tester</Button>
          <Button size="sm" onClick={onRun} disabled={isRunning}>
            {isRunning && <Spinner className="h-3.5 w-3.5" />} Exécuter
          </Button>
        </div>
        <div className="flex shrink-0 gap-1 border-l border-slate-100 pl-2 dark:border-slate-800">
          <IconButton label="Modifier" onClick={onEdit}>
            <EditIcon />
          </IconButton>
          {isDrh && (
            <IconButton
              label="Supprimer"
              onClick={onDelete}
              className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <TrashIcon />
            </IconButton>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function AutomatisationsPage() {
  const { isDrh } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRegle, setEditingRegle] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [apercuId, setApercuId] = useState(null)
  const [historiqueId, setHistoriqueId] = useState(null)
  const [testRegleTarget, setTestRegleTarget] = useState(null)
  const queryClient = useQueryClient()

  const reglesQuery = useQuery({ queryKey: ['regles'], queryFn: fetchRegles })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['regles'] })

  const closeModal = () => {
    setModalOpen(false)
    setEditingRegle(null)
  }

  const createMutation = useMutation({
    mutationFn: createRegle,
    onSuccess: () => {
      closeModal()
      invalidate()
      setToast({ message: 'Règle créée avec succès.', tone: 'success' })
    },
    onError: () => setToast({ message: 'Échec de la création de la règle.', tone: 'error' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateRegle(id, payload),
    onSuccess: () => {
      closeModal()
      invalidate()
      setToast({ message: 'Règle mise à jour.', tone: 'success' })
    },
    onError: (err) => setToast({ message: describeApiError(err, 'Échec de la mise à jour.'), tone: 'error' }),
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
    mutationFn: ({ id, testEmail }) => {
      setActiveId(id)
      return testRegle(id, testEmail)
    },
    onSuccess: (data) => {
      setTestRegleTarget(null)
      setToast({ message: `Test envoyé — statut: ${data.status === 'SENT' ? 'Envoyé' : data.status}.`, tone: 'success' })
    },
    onError: (err) => setToast({ message: describeApiError(err, 'Échec du test.'), tone: 'error' }),
    onSettled: () => setActiveId(null),
  })

  const confirmRun = (regle) => {
    if (window.confirm(`Lancer la règle "${regle.nom}" maintenant ? Des mails réels peuvent être envoyés.`)) {
      runMutation.mutate(regle.id)
    }
  }

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
        onClose={closeModal}
        onSubmit={(payload) =>
          editingRegle
            ? updateMutation.mutate({ id: editingRegle.id, payload })
            : createMutation.mutate(payload)
        }
        isPending={editingRegle ? updateMutation.isPending : createMutation.isPending}
        editingRegle={editingRegle}
      />

      {reglesQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Chargement…
        </div>
      )}

      <ApercuModal regleId={apercuId} onClose={() => setApercuId(null)} />
      <HistoriqueModal regleId={historiqueId} onClose={() => setHistoriqueId(null)} />
      <TestModal
        regle={testRegleTarget}
        onClose={() => setTestRegleTarget(null)}
        onConfirm={(testEmail) => testMutation.mutate({ id: testRegleTarget.id, testEmail })}
        isPending={testMutation.isPending}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reglesQuery.data?.map((regle) => (
          <RuleCard
            key={regle.id}
            regle={regle}
            onRun={() => confirmRun(regle)}
            onOpenTest={() => setTestRegleTarget(regle)}
            onOpenApercu={() => setApercuId(regle.id)}
            onOpenHistorique={() => setHistoriqueId(regle.id)}
            onEdit={() => {
              setEditingRegle(regle)
              setModalOpen(true)
            }}
            onDelete={() => {
              if (window.confirm(`Supprimer la règle "${regle.nom}" ?`)) deleteMutation.mutate(regle.id)
            }}
            isRunning={runMutation.isPending && activeId === regle.id}
            isDrh={isDrh}
          />
        ))}

        {reglesQuery.data?.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              title="Aucune règle configurée"
              description="Créez une règle pour automatiser les alertes de contrats expirants."
              action={
                <Button variant="secondary" onClick={() => setModalOpen(true)}>
                  <PlusIcon /> Nouvelle règle
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
