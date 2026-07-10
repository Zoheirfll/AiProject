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
          <EmptyState title="Aucun import pour le moment" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Fichier</th>
                <th className="px-5 py-3 font-medium">Origine</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Importées</th>
                <th className="px-5 py-3 font-medium">Erreurs</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {historyQuery.data.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{row.nom_fichier_origine || <EmptyCell />}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{SOURCE_LABEL[row.source] || row.source}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[row.status] || 'neutral'}>{STATUS_LABEL[row.status] || row.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{row.lignes_total}</td>
                    <td className="px-5 py-3 font-medium text-emerald-600 dark:text-emerald-400">{row.lignes_importees}</td>
                    <td className="px-5 py-3">
                      {row.lignes_erreurs ? (
                        <button
                          className="font-medium text-red-600 underline decoration-dotted hover:text-red-700 dark:text-red-400"
                          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        >
                          {row.lignes_erreurs}
                        </button>
                      ) : (
                        <EmptyCell />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isDrh && (
                        <button
                          aria-label="Supprimer"
                          className="text-slate-400 hover:text-red-600"
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
                    <tr className="bg-slate-50/60 dark:bg-slate-700/20">
                      <td colSpan={8} className="px-5 py-3">
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {row.erreurs.map((e, i) => (
                            <li key={i}>Ligne {e.ligne} : {e.message}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  )
}

function EmployeesSection() {
  const [filters, setFilters] = useState({ search: '', departement: '', categorie: '' })
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

  const sortIndicator = (field) => (ordering === field ? '▲' : ordering === `-${field}` ? '▼' : '')

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
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher nom/prénom/matricule…"
          className="max-w-xs"
          value={filters.search}
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, search: e.target.value }))
          }}
        />
        <Input
          placeholder="Département"
          className="max-w-[10rem]"
          value={filters.departement}
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, departement: e.target.value }))
          }}
        />
        <Input
          placeholder="Catégorie"
          className="max-w-[10rem]"
          value={filters.categorie}
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, categorie: e.target.value }))
          }}
        />
        <Select
          className="max-w-[12rem]"
          value=""
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, type_contrat: e.target.value }))
          }}
        >
          <option value="">Type de contrat (tous)</option>
          <option value="CDI">CDI</option>
          <option value="CDD">CDD</option>
          <option value="STAGE">Stage</option>
          <option value="AUTRE">Autre</option>
        </Select>
      </div>

      <Card padded={false}>
        {employeesQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : results.length === 0 ? (
          <EmptyState title="Aucun employé importé" />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {columns.map(([field, label]) => (
                    <th
                      key={field}
                      className="cursor-pointer select-none px-5 py-3 font-medium hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={() => toggleSort(field)}
                    >
                      {label} {sortIndicator(field)}
                    </th>
                  ))}
                  <th className="px-5 py-3 font-medium">Autres données</th>
                </tr>
              </thead>
              <tbody>
                {results.map((emp) => {
                  const extra = Object.entries(emp.donnees_supplementaires || {})
                  return (
                    <Fragment key={emp.id}>
                      <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{emp.matricule}</td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{emp.nom}</td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{emp.prenom}</td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{emp.departement || <EmptyCell />}</td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{emp.poste || <EmptyCell />}</td>
                        <td className="px-5 py-3">{emp.categorie ? <Badge tone="primary">{emp.categorie}</Badge> : <EmptyCell />}</td>
                        <td className="px-5 py-3">
                          {extra.length > 0 ? (
                            <button
                              className="text-primary-600 underline decoration-dotted hover:text-primary-700 dark:text-primary-400"
                              onClick={() => setExpanded(expanded === emp.id ? null : emp.id)}
                            >
                              +{extra.length} champ(s)
                            </button>
                          ) : (
                            <EmptyCell />
                          )}
                        </td>
                      </tr>
                      {expanded === emp.id && extra.length > 0 && (
                        <tr className="bg-slate-50/60 dark:bg-slate-700/20">
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
            <div className="flex items-center justify-between px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{count} employé(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Précédent
                </Button>
                <span>Page {page} / {totalPages}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
  const fileInputRef = useRef(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [progress, setProgress] = useState(0)
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

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <PageHeader
        title="Import Excel"
        description="Seuls matricule, nom et prenom sont requis. Les autres colonnes reconnues (email, departement, poste, categorie, num_contrat, date_embauche, date_fin_contrat) sont mappées automatiquement — toute autre colonne (congés, formations, évaluations…) est importée telle quelle, sans configuration."
      />

      <Card className="border-dashed bg-linear-to-br from-primary-50/70 via-white to-white dark:from-primary-950/30 dark:via-slate-800 dark:to-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-primary-500 to-primary-600 text-white shadow-sm">
              <UploadIcon />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-50">Sélectionner un fichier .xlsx</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Les employés sont créés ou mis à jour automatiquement.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`${api.defaults.baseURL}/api/imports/modele/`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <DownloadIcon /> Télécharger le modèle
            </a>
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
          </div>
        </div>
        {uploadMutation.isPending && (
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-primary-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </Card>

      {success && <Toast tone="success" message={success} onDismiss={() => setSuccess('')} />}
      {error && <Toast tone="error" message={error} onDismiss={() => setError('')} />}

      {isDrh && <MappingConfig />}

      <ImportHistorySection />

      <EmployeesSection />
    </div>
  )
}
