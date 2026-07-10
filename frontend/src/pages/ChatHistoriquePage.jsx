import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchConversations } from '../lib/api'
import { Card, EmptyState, PageHeader, Spinner } from '../lib/ui'

export default function ChatHistoriquePage() {
  const conversationsQuery = useQuery({ queryKey: ['conversations'], queryFn: fetchConversations })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Historique des conversations"
        description="Reprenez une conversation précédente avec l'assistant RH."
      />

      {conversationsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
      ) : conversationsQuery.data?.length === 0 ? (
        <EmptyState title="Aucune conversation pour le moment" />
      ) : (
        <div className="space-y-2">
          {conversationsQuery.data?.map((c) => (
            <Link key={c.id} to={`/agents/chat/${c.id}`}>
              <Card className="hover:border-primary-300 dark:hover:border-primary-700">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {c.titre || `Conversation #${c.id}`}
                    </p>
                    <p className="truncate text-sm text-slate-400">{c.dernier_message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(c.updated_at).toLocaleString('fr-FR')}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
