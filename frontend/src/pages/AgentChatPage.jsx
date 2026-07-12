import { useNavigate, useParams } from 'react-router-dom'
import ChatPanel from '../lib/ChatPanel'
import { Card, HelpBanner, PageHeader, useHelpBanner } from '../lib/ui'

export default function AgentChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const help = useHelpBanner('agent-chat')

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Assistant RH"
        description="Posez vos questions en langage naturel — contrats, effectifs, départements, statistiques."
        onHelp={help.reopen}
        helpVisible={!help.dismissed}
      />
      <HelpBanner dismissed={help.dismissed} onDismiss={help.dismiss} title="À quoi sert cette page ?">
        Les badges sous chaque réponse indiquent quels outils internes (effectif, contrats expirants, règles
        actives…) ont été utilisés pour construire la réponse — l'assistant ne répond jamais à l'aveugle sur
        des données RH. Ce widget est aussi disponible en popup flottant sur toutes les pages.
      </HelpBanner>
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
