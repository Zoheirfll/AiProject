import { useNavigate, useParams } from 'react-router-dom'
import ChatPanel from '../lib/ChatPanel'
import { Card, PageHeader } from '../lib/ui'

export default function AgentChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Assistant RH"
        description="Posez vos questions en langage naturel — contrats, effectifs, départements, statistiques."
      />
      <Card className="shadow-[var(--shadow-card)]">
        <ChatPanel
          key={conversationId || 'new'}
          initialConversationId={conversationId || null}
          onConversationId={(id) => {
            if (!conversationId) navigate(`/agents/chat/${id}`, { replace: true })
          }}
        />
      </Card>
    </div>
  )
}
