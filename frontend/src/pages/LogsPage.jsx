import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLogs } from '../lib/api'
import { Badge, Card, EmptyCell, EmptyState, Field, Input, PageHeader, Select, Spinner } from '../lib/ui'

const LEVEL_TONE = { INFO: 'neutral', WARNING: 'warning', ERROR: 'danger' }

const LEVELS = [
  { value: '', label: 'Tous les niveaux' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Avertissement' },
  { value: 'ERROR', label: 'Erreur' },
]

export default function LogsPage() {
  const [level, setLevel] = useState('')
  const [loggerName, setLoggerName] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const params = {}
  if (level) params.level = level
  if (loggerName) params.logger = loggerName
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo

  const logsQuery = useQuery({
    queryKey: ['logs', level, loggerName, dateFrom, dateTo],
    queryFn: () => fetchLogs(params),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <PageHeader title="Logs techniques" description="Journal applicatif (INFO / WARNING / ERROR), consultable et filtrable." />

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Niveau">
          <Select value={level} onChange={(e) => setLevel(e.target.value)} className="cursor-pointer">
            {LEVELS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type (logger)">
          <Input
            placeholder="ex: grh_auto.core"
            value={loggerName}
            onChange={(e) => setLoggerName(e.target.value)}
          />
        </Field>
        <Field label="Du">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="cursor-pointer" />
        </Field>
        <Field label="Au">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="cursor-pointer" />
        </Field>
      </Card>

      <Card padded={false}>
        {logsQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400">
            <Spinner /> Chargement…
          </div>
        ) : logsQuery.data?.length === 0 ? (
          <div className="p-2">
            <EmptyState title="Aucun log" description="Aucun événement technique ne correspond à ces filtres." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Niveau</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Message</th>
                </tr>
              </thead>
              <tbody>
                {logsQuery.data?.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                    <td className="whitespace-nowrap px-5 py-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {new Date(row.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-2">
                      <Badge tone={LEVEL_TONE[row.level] || 'neutral'}>{row.level}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {row.logger_name || <EmptyCell />}
                    </td>
                    <td className="px-5 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
