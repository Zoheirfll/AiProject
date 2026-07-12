import { Fragment, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  deleteImport,
  fetchEmployeesPage,
  fetchImportHistory,
  fetchImportMapping,
  saveImportMapping,
  uploadExcelImport,
} from '../lib/api'
import {
  Badge,
  BoltIcon,
  Button,
  Card,
  DownloadIcon,
  EmptyCell,
  EmptyState,
  Field,
  GridIcon,
  HelpBanner,
  useHelpBanner,
  HistoryIcon,
  Input,
  PageHeader,
  Select,
  Spinner,
  Toast,
  TrashIcon,
  UploadIcon,
} from '../lib/ui'
import { statusTone } from '../theme'
import { useAuth } from '../lib/AuthContext'
import { describeApiError } from '../lib/errors'

const STATUS_LABEL = { SUCCESS: 'Succès', FAILED: 'Échec', PENDING: 'En cours' }
const SOURCE_LABEL = { UPLOAD: 'Upload manuel', DOSSIER: 'Dossier surveillé' }

function ChevronIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  )
}

function SortIcon({ active, desc }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-300 dark:text-slate-600'}`}>
      {active ? (
        desc ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
      )}
    </svg>
  )
}

function SectionTitle({ icon: Icon, tone, children }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
  }
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </h2>
  )
}

function MappingConfig() {
  const queryClient = useQueryClient()
  const [dossier, setDossier] = useState('')
  const [mapping, setMapping] = useState({})
  const [saved, setSaved] = useState(false)

  const configQuery = useQuery({
    queryKey: ['imports-mapping'],
    queryFn: fetchImportMapping,
  })

  useEffect(() => {
    if (configQuery.data) {
      setDossier(configQuery.data.dossier_surveille || '')
      setMapping(configQuery.data.mapping || {})
    }
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: saveImportMapping,
    onSuccess: (data) => {
      setDossier(data.dossier_surveille || '')
      setMapping(data.mapping || {})
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['imports-mapping'] })
      setTimeout(() => setSaved(false), 2500)
    },
  })

  if (configQuery.isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
      </Card>
    )
  }

  const champs = configQuery.data?.champs || []

  return (
    <Card className="space-y-5">
      <SectionTitle icon={BoltIcon} tone="violet">Import automatique &amp; mapping</SectionTitle>
      <div>
        <h3 className="font-medium text-slate-900 dark:text-slate-50">Dossier surveillé</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tout fichier .xlsx/.xls déposé dans ce dossier est importé automatiquement (vérifié toutes les 45s),
          puis déplacé dans un sous-dossier <code>processed</code>.
        </p>
        <div className="mt-2 max-w-lg">
          <Input
            value={dossier}
            onChange={(e) => setDossier(e.target.value)}
            placeholder="Ex: C:\\GRH\\imports_auto"
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium text-slate-900 dark:text-slate-50">Mapping des colonnes</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Associez chaque champ système au nom (en-tête) de la colonne dans vos fichiers Excel. Laissez vide
          pour utiliser la détection automatique par défaut.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {champs.map((field) => (
            <Field key={field} label={field}>
              <Input
                value={mapping[field] || ''}
                onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                placeholder={`colonne Excel pour "${field}"`}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate({ mapping, dossier_surveille: dossier })}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Spinner />}
          Enregistrer
        </Button>
        {saved && <span className="text-sm text-emerald-600">Configuration enregistrée.</span>}
      </div>
    </Card>
  )
}

function ImportHistorySection() {
  const { isDrh } = useAuth()
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(null)

  const historyQuery = useQuery({ queryKey: ['imports-history'], queryFn: fetchImportHistory })

  const deleteMutation = useMutation({
    mutationFn: deleteImport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['imports-history'] }),
  })

  return (
    <section className="space-y-3">
      <SectionTitle icon={HistoryIcon} tone="amber">Historique des imports</SectionTitle>
      <Card padded={false}>
        {historyQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : historyQuery.data?.length === 0 ? (
          <EmptyState title="Aucun import pour le moment" description="Les fichiers importés apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-215 text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Fichier</th>
                  <th className="px-5 py-3 font-medium">Origine</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Importées</th>
                  <th className="px-5 py-3 font-medium">Erreurs</th>
                  {isDrh && <th className="px-5 py-3 font-medium">Importé par</th>}
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {historyQuery.data.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/80 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 dark:text-slate-400">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                      <td className="px-5 py-3.5 font-medium text-slate-700 dark:text-slate-300">{row.nom_fichier_origine || <EmptyCell />}</td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{SOURCE_LABEL[row.source] || row.source}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone[row.status] || 'neutral'}>{STATUS_LABEL[row.status] || row.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{row.lignes_total}</td>
                      <td className="px-5 py-3.5 font-medium text-emerald-600 dark:text-emerald-400">{row.lignes_importees}</td>
                      <td className="px-5 py-3.5">
                        {row.lignes_erreurs ? (
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/40"
                            aria-expanded={expanded === row.id}
                            aria-label={`${expanded === row.id ? 'Masquer' : 'Afficher'} le détail des erreurs`}
                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                          >
                            <ChevronIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded === row.id ? 'rotate-90' : ''}`} />
                            {row.lignes_erreurs}
                          </button>
                        ) : (
                          <EmptyCell />
                        )}
                      </td>
                      {isDrh && (
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                          {row.cree_par_username || <EmptyCell />}
                        </td>
                      )}
                      <td className="px-5 py-3.5 text-right">
                        {isDrh && (
                          <button
                            type="button"
                            aria-label="Supprimer cet import"
                            title="Supprimer cet import"
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/40"
                            onClick={() => {
                              if (confirm('Supprimer cet import ?')) deleteMutation.mutate(row.id)
                            }}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === row.id && row.erreurs?.length > 0 && (
                      <tr className="bg-slate-50/80 dark:bg-slate-700/20">
                        <td colSpan={isDrh ? 9 : 8} className="px-5 py-3">
                          <div className="rounded-lg border border-red-100 bg-red-50/60 p-3 dark:border-red-900/40 dark:bg-red-950/20">
                            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {row.erreurs.map((e, i) => (
                                <li key={i}>
                                  <span className="font-medium text-red-600 dark:text-red-400">Ligne {e.ligne}</span> : {e.message}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}

function EmployeesSection() {
  const [filters, setFilters] = useState({ search: '', departement: '', categorie: '', type_contrat: '' })
  const [ordering, setOrdering] = useState('nom')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState(null)

  const employeesQuery = useQuery({
    queryKey: ['employees-page', filters, ordering, page],
    queryFn: () =>
      fetchEmployeesPage({
        ...filters,
        ordering,
        page,
        page_size: 20,
      }),
  })

  const toggleSort = (field) => {
    setPage(1)
    setOrdering((prev) => (prev === field ? `-${field}` : field))
  }

  const columns = [
    ['matricule', 'Matricule'],
    ['nom', 'Nom'],
    ['prenom', 'Prénom'],
    ['departement', 'Département'],
    ['poste', 'Poste'],
    ['categorie', 'Catégorie'],
  ]

  const results = employeesQuery.data?.results ?? employeesQuery.data ?? []
  const count = employeesQuery.data?.count ?? results.length
  const totalPages = Math.max(1, Math.ceil(count / 20))

  return (
    <section className="space-y-3">
      <SectionTitle icon={GridIcon} tone="emerald">Employés</SectionTitle>
      <Card className="p-4!">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Recherche">
              <Input
                placeholder="Nom, prénom, matricule…"
                value={filters.search}
                onChange={(e) => {
                  setPage(1)
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }}
              />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Département">
              <Input
                placeholder="Tous"
                value={filters.departement}
                onChange={(e) => {
                  setPage(1)
                  setFilters((f) => ({ ...f, departement: e.target.value }))
                }}
              />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Catégorie">
              <Input
                placeholder="Toutes"
                value={filters.categorie}
                onChange={(e) => {
                  setPage(1)
                  setFilters((f) => ({ ...f, categorie: e.target.value }))
                }}
              />
            </Field>
          </div>
          <div className="w-44">
            <Field label="Type de contrat">
              <Select
                value={filters.type_contrat}
                onChange={(e) => {
                  setPage(1)
                  setFilters((f) => ({ ...f, type_contrat: e.target.value }))
                }}
              >
                <option value="">Tous</option>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="STAGE">Stage</option>
                <option value="AUTRE">Autre</option>
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        {employeesQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : results.length === 0 ? (
          <EmptyState title="Aucun employé importé" description="Ajustez vos filtres ou importez un fichier Excel." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-215 text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {columns.map(([field, label]) => {
                      const active = ordering === field || ordering === `-${field}`
                      const desc = ordering === `-${field}`
                      return (
                        <th
                          key={field}
                          scope="col"
                          aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(field)}
                            className={`inline-flex w-full cursor-pointer select-none items-center gap-1 px-5 py-3 text-left font-medium transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-slate-200 ${
                              active ? 'text-slate-800 dark:text-slate-100' : ''
                            }`}
                          >
                            {label}
                            <SortIcon active={active} desc={desc} />
                          </button>
                        </th>
                      )
                    })}
                    <th className="px-5 py-3 font-medium">Autres données</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((emp) => {
                    const extra = Object.entries(emp.donnees_supplementaires || {})
                    return (
                      <Fragment key={emp.id}>
                        <tr className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/80 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                          <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">{emp.matricule}</td>
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{emp.nom}</td>
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{emp.prenom}</td>
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{emp.departement || <EmptyCell />}</td>
                          <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300">{emp.poste || <EmptyCell />}</td>
                          <td className="px-5 py-3.5">{emp.categorie ? <Badge tone="primary">{emp.categorie}</Badge> : <EmptyCell />}</td>
                          <td className="px-5 py-3.5">
                            {extra.length > 0 ? (
                              <button
                                type="button"
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary-600 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-950/40"
                                aria-expanded={expanded === emp.id}
                                aria-label={`${expanded === emp.id ? 'Masquer' : 'Afficher'} les champs supplémentaires`}
                                onClick={() => setExpanded(expanded === emp.id ? null : emp.id)}
                              >
                                <ChevronIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded === emp.id ? 'rotate-90' : ''}`} />
                                +{extra.length} champ{extra.length > 1 ? 's' : ''}
                              </button>
                            ) : (
                              <EmptyCell />
                            )}
                          </td>
                        </tr>
                        {expanded === emp.id && extra.length > 0 && (
                          <tr className="bg-slate-50/80 dark:bg-slate-700/20">
                            <td colSpan={columns.length + 1} className="px-5 py-3">
                              <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                                {extra.map(([key, value]) => (
                                  <li key={key}><span className="text-slate-400">{key} :</span> {value}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <span>{count} employé(s)</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-11! min-w-11!"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Page précédente"
                >
                  Précédent
                </Button>
                <span className="min-w-24 text-center font-medium text-slate-700 dark:text-slate-300">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-11! min-w-11!"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Page suivante"
                >
                  Suivant
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  )
}

export default function ImportsPage() {
  const { isDrh } = useAuth()
  const help = useHelpBanner('imports')
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [manualUploadOpen, setManualUploadOpen] = useState(false)
  const queryClient = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: (file) =>
      uploadExcelImport(file, (evt) => {
        if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100))
      }),
    onSuccess: (data) => {
      setError('')
      setProgress(0)
      if (data.status === 'SUCCESS') {
        setSuccess(`Import réussi : ${data.lignes_importees} ligne(s) importée(s) sur ${data.lignes_total}.`)
      } else {
        setError("L'import a échoué. Consultez le détail des erreurs dans l'historique.")
      }
      queryClient.invalidateQueries({ queryKey: ['imports-history'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees-page'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err) => {
      setProgress(0)
      setError(describeApiError(err, "Échec de l'import."))
    },
  })

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSuccess('')
      uploadMutation.mutate(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!uploadMutation.isPending) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (uploadMutation.isPending) return
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSuccess('')
      uploadMutation.mutate(file)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <PageHeader
        title="Import Excel"
        description="Le dossier surveillé est le flux principal : tout fichier déposé y est lu et importé automatiquement, sans action humaine. Seuls matricule, nom et prenom sont requis — toute autre colonne (congés, formations, évaluations…) est conservée telle quelle."
        onHelp={help.reopen}
        helpVisible={!help.dismissed}
      />

      <HelpBanner dismissed={help.dismissed} onDismiss={help.dismiss} title="À quoi sert cette page ?">
        Configurez le dossier surveillé ci-dessous : tout fichier .xlsx/.xls qui y est déposé est lu et importé
        automatiquement (vérifié toutes les 45s), sans que personne n'ait besoin d'ouvrir cette page. L'import
        manuel plus bas n'est qu'un dépannage ponctuel (un fichier à passer une seule fois, hors du dossier).
      </HelpBanner>

      {isDrh && <MappingConfig />}

      {success && <Toast tone="success" message={success} onDismiss={() => setSuccess('')} />}
      {error && <Toast tone="error" message={error} onDismiss={() => setError('')} />}

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setManualUploadOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center gap-2 text-left text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-expanded={manualUploadOpen}
        >
          <ChevronIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${manualUploadOpen ? 'rotate-90' : ''}`} />
          Import manuel ponctuel (dépannage — hors dossier surveillé)
        </button>

        {manualUploadOpen && (
          <Card
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed bg-linear-to-br transition-colors duration-150 ${
              isDragging
                ? 'border-primary-500 from-primary-100/80 via-primary-50/40 to-white dark:border-primary-400 dark:from-primary-950/50 dark:via-slate-800 dark:to-slate-800'
                : 'border-slate-300 from-primary-50/70 via-white to-white dark:border-slate-600 dark:from-primary-950/30 dark:via-slate-800 dark:to-slate-800'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-600 text-white shadow-sm transition-transform duration-150 ${
                    isDragging ? 'scale-110' : ''
                  }`}
                >
                  <UploadIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-50">
                    {isDragging ? 'Déposez le fichier ici' : 'Glissez-déposez un fichier .xlsx, ou choisissez-en un'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Les employés sont créés ou mis à jour automatiquement.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`${api.defaults.baseURL}/api/imports/modele/`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <DownloadIcon /> Télécharger le modèle
                </a>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2">
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
              </div>
            </div>
            {uploadMutation.isPending && (
              <div className="mt-4 space-y-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-primary-500 to-primary-600 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-right text-xs font-medium text-slate-500 dark:text-slate-400">{progress}%</p>
              </div>
            )}
          </Card>
        )}
      </section>

      <ImportHistorySection />

      <EmployeesSection />
    </div>
  )
}
