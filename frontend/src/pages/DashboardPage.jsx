import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchActiviteRecente,
  fetchAutomatisationsTypes,
  fetchContratsParMois,
  fetchDashboardKpis,
  fetchMailsEvolution,
} from '../lib/api'
import {
  Card,
  EmptyState,
  HelpBanner,
  MailIcon,
  PageHeader,
  Spinner,
  UploadIcon,
  BoltIcon,
  EyeIcon,
  CheckCircleIcon,
  CloseIcon,
  FileTextIcon,
  useHelpBanner,
} from '../lib/ui'
import { chartPalette } from '../theme'
import { useNotifications } from '../lib/useNotifications'

const TILE_TONE = {
  neutral: {
    border: 'border-l-slate-300 dark:border-l-slate-600',
    iconBg: 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300',
    value: 'text-slate-900 dark:text-slate-50',
  },
  success: {
    border: 'border-l-emerald-400 dark:border-l-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    border: 'border-l-amber-400 dark:border-l-amber-500',
    iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    border: 'border-l-red-400 dark:border-l-red-500',
    iconBg: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
    value: 'text-red-600 dark:text-red-400',
  },
  primary: {
    border: 'border-l-primary-400 dark:border-l-primary-500',
    iconBg: 'bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300',
    value: 'text-primary-600 dark:text-primary-400',
  },
}

function StatTile({ label, value, tone = 'neutral', icon: Icon }) {
  const t = TILE_TONE[tone] || TILE_TONE.neutral
  return (
    <Card
      padded={false}
      className={`flex items-center gap-2.5 border-l-4 p-3 transition hover:-translate-y-0.5 hover:shadow-(--shadow-raised) ${t.border}`}
    >
      {Icon && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.iconBg}`}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium uppercase leading-tight tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className={`text-2xl font-bold leading-tight ${t.value}`}>{value}</p>
      </div>
    </Card>
  )
}

function StatusTile({ label, connecte }) {
  const tone = connecte ? TILE_TONE.success : TILE_TONE.danger
  return (
    <Card
      padded={false}
      className={`flex items-center gap-2.5 border-l-4 p-3 transition hover:-translate-y-0.5 hover:shadow-(--shadow-raised) ${tone.border}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.iconBg}`}>
        {connecte ? <CheckCircleIcon className="h-4 w-4" /> : <CloseIcon className="h-4 w-4" />}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium uppercase leading-tight tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className={`text-sm font-semibold ${tone.value}`}>{connecte ? 'Connecté' : 'Déconnecté'}</p>
      </div>
    </Card>
  )
}

const ACTIVITY_ICON = { mail: MailIcon, import: UploadIcon, alerte: BoltIcon, surveillance: EyeIcon }

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const help = useHelpBanner('dashboard')

  const kpisQuery = useQuery({ queryKey: ['dashboard-kpis'], queryFn: fetchDashboardKpis, refetchInterval: 30000 })
  const evolutionQuery = useQuery({ queryKey: ['dashboard-evolution'], queryFn: () => fetchMailsEvolution(30) })
  const typesQuery = useQuery({ queryKey: ['dashboard-types'], queryFn: fetchAutomatisationsTypes })
  const contratsQuery = useQuery({ queryKey: ['dashboard-contrats'], queryFn: fetchContratsParMois })
  const activiteQuery = useQuery({ queryKey: ['dashboard-activite'], queryFn: () => fetchActiviteRecente(20) })

  useNotifications(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-evolution'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-types'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-activite'] })
  })

  const typesData = useMemo(
    () => (typesQuery.data || []).filter((d) => d.valeur > 0),
    [typesQuery.data]
  )

  const kpis = kpisQuery.data

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <PageHeader
        title="Dashboard"
        description="Vue d'ensemble instantanée de l'activité RH et des automatisations."
        onHelp={help.reopen}
        helpVisible={!help.dismissed}
      />

      <HelpBanner dismissed={help.dismissed} onDismiss={help.dismiss} title="À quoi sert cette page ?">
        Les tuiles KPI (mails, règles actives, contrats expirants, statut Ollama/n8n) et les graphiques se
        mettent à jour en temps réel via WebSocket dès qu'un mail part ou qu'un import se termine — pas besoin
        de rafraîchir. Chaque ligne de "Activité récente" renvoie vers le détail correspondant.
      </HelpBanner>

      {kpisQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement des KPIs…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatTile label="Mails aujourd'hui" value={kpis?.mails_envoyes_aujourdhui ?? 0} tone="primary" icon={MailIcon} />
          <StatTile label="Mails cette semaine" value={kpis?.mails_envoyes_semaine ?? 0} tone="primary" icon={MailIcon} />
          <StatTile label="Mails ce mois" value={kpis?.mails_envoyes_mois ?? 0} tone="primary" icon={MailIcon} />
          <StatTile label="Règles actives" value={kpis?.regles_actives ?? 0} tone="success" icon={BoltIcon} />
          <StatTile
            label="Contrats expirant (30j)"
            value={kpis?.contrats_expirant_30j ?? 0}
            tone={kpis?.contrats_expirant_30j ? 'warning' : 'neutral'}
            icon={FileTextIcon}
          />
          <StatusTile label="Ollama" connecte={kpis?.ollama_connecte} />
          <StatusTile label="n8n" connecte={kpis?.n8n_connecte} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Évolution des envois</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">30 derniers jours</span>
          </div>
          {evolutionQuery.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : !evolutionQuery.data?.length ? (
            <EmptyState title="Aucune donnée d'envoi" description="Aucun mail envoyé sur cette période." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolutionQuery.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  className="rounded-lg! bg-white! text-slate-700! shadow-(--shadow-raised)! dark:bg-slate-800! dark:text-slate-100! dark:border-slate-600!"
                />
                <Line type="monotone" dataKey="envois" stroke={chartPalette[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Types d'automatisations</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">mails envoyés</span>
          </div>
          {typesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : typesData.length === 0 ? (
            <EmptyState title="Aucun mail envoyé" description="Rien à afficher pour le moment." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={typesData}
                  dataKey="valeur"
                  nameKey="type"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {typesData.map((entry, i) => (
                    <Cell key={entry.type} fill={chartPalette[i % chartPalette.length]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                  className="rounded-lg! bg-white! text-slate-700! shadow-(--shadow-raised)! dark:bg-slate-800! dark:text-slate-100! dark:border-slate-600!"
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Contrats par mois d'expiration</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">12 prochains mois</span>
        </div>
        {contratsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : !contratsQuery.data?.length ? (
          <EmptyState title="Aucun contrat à venir" description="Aucune expiration prévue sur les 12 prochains mois." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={contratsQuery.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                className="rounded-lg! bg-white! text-slate-700! shadow-(--shadow-raised)! dark:bg-slate-800! dark:text-slate-100! dark:border-slate-600!"
              />
              <Bar dataKey="contrats" fill={chartPalette[0]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Activité récente</h2>
        <Card padded={false}>
          {activiteQuery.isLoading ? (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : activiteQuery.data?.length === 0 ? (
            <EmptyState title="Aucune activité pour le moment" description="Les envois, imports et alertes récents apparaîtront ici." />
          ) : (
            <ul>
              {activiteQuery.data?.map((event, i) => {
                const Icon = ACTIVITY_ICON[event.type] || MailIcon
                return (
                  <li key={i} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                    <Link
                      to={event.lien}
                      className="flex cursor-pointer items-center gap-3 px-5 py-3 text-sm outline-none transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-700/40 dark:focus-visible:bg-slate-700/40"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{event.label}</span>
                      <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                        {new Date(event.timestamp).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}
