import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/AuthContext'
import { describeApiError } from '../lib/errors'
import {
  createRegle,
  deleteRegle,
  fetchAutomatisationConfig,
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
  DotsIcon,
  DropdownMenu,
  EditIcon,
  EmptyState,
  Field,
  HelpBanner,
  useHelpBanner,
  HistoryIcon,
  Input,
  Modal,
  PageHeader,
  PlusIcon,
  Select,
  SearchIcon,
  Spinner,
  TagInput,
  Textarea,
  Toast,
  TrashIcon,
} from '../lib/ui'

const OPERATEURS = [
  { value: 'INFERIEUR_A', label: 'Inférieur à' },
  { value: 'SUPERIEUR_A', label: 'Supérieur à' },
  { value: 'EGAL', label: 'Égal à' },
  { value: 'CONTIENT', label: 'Contient' },
  { value: 'VIDE', label: 'Est vide / absent' },
]

const OPERATEUR_SYMBOLE = {
  INFERIEUR_A: '<',
  SUPERIEUR_A: '>',
  EGAL: '=',
  CONTIENT: '⊃',
  VIDE: 'est vide',
}

const emptyForm = {
  nom: '',
  actif: true,
  type_condition: 'CONTRAT',
  delais_jours: ['45', '20', '7'],
  champ_cible: '',
  operateur: 'INFERIEUR_A',
  valeur_seuil: '',
  departements_filtre: [],
  destinataires: [],
  cc: [],
  bcc: [],
  prompt_override: '',
  format: 'TEXTE',
}

function regleToForm(regle) {
  return {
    nom: regle.nom,
    actif: regle.actif,
    type_condition: regle.type_condition || 'CONTRAT',
    delais_jours: regle.delais_jours.map(String),
    champ_cible: regle.champ_cible || '',
    operateur: regle.operateur || 'INFERIEUR_A',
    valeur_seuil: regle.valeur_seuil || '',
    departements_filtre: regle.departements_filtre || [],
    destinataires: regle.destinataires || [],
    cc: regle.cc || [],
    bcc: regle.bcc || [],
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
      type_condition: form.type_condition,
      delais_jours: form.delais_jours.map(Number).filter((n) => !Number.isNaN(n)),
      champ_cible: form.champ_cible,
      operateur: form.type_condition === 'CHAMP_PERSONNALISE' ? form.operateur : '',
      valeur_seuil: form.valeur_seuil,
      departements_filtre: form.departements_filtre,
      destinataires: form.destinataires,
      cc: form.cc,
      bcc: form.bcc,
      prompt_override: form.prompt_override,
      format: form.format,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title={editingRegle ? `Modifier "${editingRegle.nom}"` : "Nouvelle règle d'automatisation"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          {form.type_condition === 'CHAMP_PERSONNALISE'
            ? "La règle se déclenche sur n'importe quelle colonne de vos fichiers importés (congés, formations…), pas seulement les contrats. Pas d'envoi en double : un employé déjà alerté aujourd'hui ne repart pas avant demain."
            : "Une alerte part pour chaque délai renseigné (ex: 45, 20 et 7 jours avant échéance) et par contrat concerné — pas d'envoi en double, une alerte déjà envoyée pour un délai donné ne repart pas."}
        </p>
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
          <Field
            label="Type de condition"
            hint={
              form.type_condition === 'CHAMP_PERSONNALISE'
                ? "Se déclenche sur n'importe quelle colonne de vos fichiers importés (congés, formations…), pas seulement les contrats."
                : 'Se déclenche sur la date de fin des contrats.'
            }
          >
            <Select
              value={form.type_condition}
              onChange={(e) => setForm({ ...form, type_condition: e.target.value })}
            >
              <option value="CONTRAT">Contrat expirant</option>
              <option value="CHAMP_PERSONNALISE">Champ personnalisé</option>
            </Select>
          </Field>

          {form.type_condition === 'CONTRAT' ? (
            <Field label="Délais d'alerte (jours)" hint="Entrée ou virgule pour ajouter.">
              <TagInput
                placeholder="45, 20, 7"
                value={form.delais_jours}
                onChange={(v) => setForm({ ...form, delais_jours: v })}
              />
            </Field>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Champ à surveiller" hint='Ex: "jours_conges_restants".'>
                <Input
                  placeholder="Nom de la colonne Excel"
                  value={form.champ_cible}
                  onChange={(e) => setForm({ ...form, champ_cible: e.target.value })}
                  required={form.type_condition === 'CHAMP_PERSONNALISE'}
                />
              </Field>
              <Field label="Condition">
                <Select value={form.operateur} onChange={(e) => setForm({ ...form, operateur: e.target.value })}>
                  {OPERATEURS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </Select>
              </Field>
              {form.operateur !== 'VIDE' && (
                <Field label="Valeur">
                  <Input
                    placeholder="Ex: 5"
                    value={form.valeur_seuil}
                    onChange={(e) => setForm({ ...form, valeur_seuil: e.target.value })}
                  />
                </Field>
              )}
            </div>
          )}

          <Field label="Départements filtrés" hint="Vide = tous les départements.">
            <TagInput
              placeholder="IT, RH…"
              value={form.departements_filtre}
              onChange={(v) => setForm({ ...form, departements_filtre: v })}
            />
          </Field>
        </div>

        <div className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Destinataires
          </h4>
          <Field label="Destinataires" hint="Emails fixes ou alias departement:NomDuDept.">
            <TagInput
              placeholder="rh@example.com, departement:IT"
              value={form.destinataires}
              onChange={(v) => setForm({ ...form, destinataires: v })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CC">
              <TagInput value={form.cc} onChange={(v) => setForm({ ...form, cc: v })} />
            </Field>
            <Field label="BCC">
              <TagInput value={form.bcc} onChange={(v) => setForm({ ...form, bcc: v })} />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Contenu du mail
          </h4>
          <Field label="Prompt personnalisé (optionnel)">
            <Textarea
              placeholder={
                form.type_condition === 'CHAMP_PERSONNALISE'
                  ? 'Variables: {{nom}} {{departement}} {{champ}} {{valeur}}'
                  : 'Variables: {{nom}} {{departement}} {{date_fin}} {{jours_restants}}'
              }
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
                      {e.nom} — {e.departement || 'N/A'} —{' '}
                      {e.champ ? `${e.champ} = ${e.valeur}` : `J-${e.jours_restants} (${e.date_fin})`}
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
                {a.employee_nom}
                {a.delai_jours != null && ` — J-${a.delai_jours} (${a.date_fin})`}
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

// Fetches just the "concerned now" count for the state badge — same endpoint
// the Aperçu modal uses, kept cheap via a long staleTime since it's shown on
// every card at once.
function ConcernedBadge({ regleId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['regle-apercu', regleId],
    queryFn: () => fetchRegleApercu(regleId),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return null
  const count = data?.employes_concernes?.length || 0
  return (
    <Badge tone={count > 0 ? 'warning' : 'neutral'}>
      {count > 0 ? `${count} concerné(s) maintenant` : 'Rien à déclencher'}
    </Badge>
  )
}

function RuleCard({ regle, onRun, onOpenTest, onOpenApercu, onOpenHistorique, onEdit, onDelete, isRunning, isDrh }) {
  const menuItems = [
    { label: 'Aperçu', icon: <BoltIcon className="h-4 w-4" />, onClick: onOpenApercu },
    { label: 'Historique', icon: <HistoryIcon className="h-4 w-4" />, onClick: onOpenHistorique },
    { label: 'Tester', icon: <BoltIcon className="h-4 w-4" />, onClick: onOpenTest },
    { label: 'Modifier', icon: <EditIcon className="h-4 w-4" />, onClick: onEdit },
  ]
  if (isDrh) {
    menuItems.push({ label: 'Supprimer', icon: <TrashIcon className="h-4 w-4" />, onClick: onDelete, danger: true })
  }

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
            {regle.actif && <ConcernedBadge regleId={regle.id} />}
            {regle.type_condition === 'CHAMP_PERSONNALISE' ? (
              <Badge tone="primary">
                {regle.champ_cible || '?'} {OPERATEUR_SYMBOLE[regle.operateur] || ''} {regle.operateur !== 'VIDE' ? regle.valeur_seuil : ''}
              </Badge>
            ) : (
              <Badge tone="neutral">Délais: {regle.delais_jours.join(', ') || '—'} j</Badge>
            )}
            {regle.departements_filtre?.length > 0 ? (
              <Badge tone="neutral">{regle.departements_filtre.join(', ')}</Badge>
            ) : (
              <Badge tone="neutral">Tous départements</Badge>
            )}
          </div>

          {isDrh && regle.cree_par_username && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Créée par {regle.cree_par_username}</p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Button onClick={onRun} disabled={isRunning}>
          {isRunning && <Spinner className="h-3.5 w-3.5" />} Exécuter
        </Button>
        <DropdownMenu
          items={menuItems}
          trigger={
            <button
              type="button"
              aria-label="Plus d'actions"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <DotsIcon />
            </button>
          }
        />
      </div>
    </Card>
  )
}

export default function AutomatisationsPage() {
  const { isDrh } = useAuth()
  const help = useHelpBanner('automatisations')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRegle, setEditingRegle] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [apercuId, setApercuId] = useState(null)
  const [historiqueId, setHistoriqueId] = useState(null)
  const [testRegleTarget, setTestRegleTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('TOUS')
  const queryClient = useQueryClient()

  const reglesQuery = useQuery({ queryKey: ['regles'], queryFn: fetchRegles })
  const configQuery = useQuery({ queryKey: ['automatisation-config'], queryFn: fetchAutomatisationConfig })
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

  const filteredRegles = useMemo(() => {
    return (reglesQuery.data || []).filter((r) => {
      if (statusFilter === 'ACTIVE' && !r.actif) return false
      if (statusFilter === 'INACTIVE' && r.actif) return false
      if (search.trim() && !r.nom.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [reglesQuery.data, search, statusFilter])

  const heureRapport = configQuery.data?.heure_rapport_quotidien
  const description = heureRapport
    ? `Règles d'alerte de contrats expirants — rapport quotidien envoyé à ${heureRapport.slice(0, 5)}.`
    : "Règles d'alerte de contrats expirants."

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader
        title="Automatisations"
        description={description}
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <PlusIcon /> Nouvelle règle
          </Button>
        }
        onHelp={help.reopen}
        helpVisible={!help.dismissed}
      />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      <HelpBanner dismissed={help.dismissed} onDismiss={help.dismiss} title="À quoi sert cette page ?">
        Chaque règle surveille les contrats qui approchent de leur date de fin et envoie une alerte email
        générée par IA aux délais configurés (ex: J-45, J-20, J-7). Utilisez "Aperçu" pour voir qui serait
        alerté sans rien envoyer, et "Tester" pour recevoir un exemple sur votre propre adresse avant d'activer.
      </HelpBanner>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Rechercher une règle par nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="sm:w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="TOUS">Toutes les règles</option>
          <option value="ACTIVE">Actives seulement</option>
          <option value="INACTIVE">Inactives seulement</option>
        </Select>
      </div>

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
        {filteredRegles.map((regle) => (
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

        {!reglesQuery.isLoading && filteredRegles.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              title={reglesQuery.data?.length ? 'Aucune règle ne correspond' : 'Aucune règle configurée'}
              description={
                reglesQuery.data?.length
                  ? 'Essayez une autre recherche ou changez le filtre.'
                  : 'Créez une règle pour automatiser les alertes de contrats expirants.'
              }
              action={
                !reglesQuery.data?.length && (
                  <Button variant="secondary" onClick={() => setModalOpen(true)}>
                    <PlusIcon /> Nouvelle règle
                  </Button>
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
