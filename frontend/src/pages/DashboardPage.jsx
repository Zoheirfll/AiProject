import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { Badge, Card, EmptyState, MailIcon, PageHeader, Spinner, UploadIcon, BoltIcon, EyeIcon } from '../lib/ui'
import { chartPalette } from '../theme'
import { useNotifications } from '../lib/useNotifications'

function StatTile({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-slate-900 dark:text-slate-50',
    success: 'text-emerald-600 dark:text-emerald-400',
    danger: 'text-red-600 dark:text-red-400',
  }
  return (
    <Card className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${tones[tone]}`}>{value}</p>
    </Card>
  )
}

function StatusTile({ label, connecte }) {
  return (
    <Card className="flex items-center justify-between">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <Badge tone={connecte ? 'success' : 'danger'}>{connecte ? 'Connecté' : 'Déconnecté'}</Badge>
    </Card>
  )
}

const ACTIVITY_ICON = { mail: MailIcon, import: UploadIcon, alerte: BoltIcon, surveillance: EyeIcon }

export default function DashboardPage() {
  const queryClient = useQueryClient()

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
      />

      {kpisQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement des KPIs…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          <StatTile label="Mails aujourd'hui" value={kpis?.mails_envoyes_aujourdhui ?? 0} />
          <StatTile label="Mails cette semaine" value={kpis?.mails_envoyes_semaine ?? 0} />
          <StatTile label="Mails ce mois" value={kpis?.mails_envoyes_mois ?? 0} />
          <StatTile label="Règles actives" value={kpis?.regles_actives ?? 0} />
          <StatTile
            label="Contrats expirant (30j)"
            value={kpis?.contrats_expirant_30j ?? 0}
            tone={kpis?.contrats_expirant_30j ? 'danger' : 'neutral'}
          />
          <StatusTile label="Ollama" connecte={kpis?.ollama_connecte} />
          <StatusTile label="n8n" connecte={kpis?.n8n_connecte} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Évolution des envois (30 derniers jours)
          </h2>
          {evolutionQuery.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolutionQuery.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Line type="monotone" dataKey="envois" stroke={chartPalette[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Types d'automatisations (mails envoyés)</h2>
          {typesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
          ) : typesData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Aucun mail envoyé pour le moment.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={typesData} dataKey="valeur" nameKey="type" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {typesData.map((entry, i) => (
                    <Cell key={entry.type} fill={chartPalette[i % chartPalette.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Contrats par mois d'expiration</h2>
        {contratsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={contratsQuery.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-700" />
              <XAxis dataKey="mois" tick={{ fontSize: 11 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
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
            <EmptyState title="Aucune activité pour le moment" />
          ) : (
            <ul>
              {activiteQuery.data?.map((event, i) => {
                const Icon = ACTIVITY_ICON[event.type] || MailIcon
                return (
                  <li key={i} className="border-b border-slate-50 last:border-0 dark:border-slate-700/60">
                    <Link
                      to={event.lien}
                      className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50/60 dark:hover:bg-slate-700/30"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-slate-700 dark:text-slate-300">{event.label}</span>
                      <span className="shrink-0 text-slate-400 dark:text-slate-500">
                        {new Date(event.timestamp).toLocaleString('fr-FR')}
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
