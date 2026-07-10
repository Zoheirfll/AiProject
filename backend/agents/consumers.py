import json

from asgiref.sync import async_to_sync, sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import AgentConfig, ChatConversation, ChatMessage
from .ollama_client import OllamaGenerationError, stream_chat
from .outils import route_and_call


class ChatConsumer(AsyncWebsocketConsumer):
    """Streams the HR chat assistant's reply token-by-token (US-E6-02) and
    persists both sides of the conversation for later resume (US-E6-03)."""

    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        await self.accept()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except ValueError:
            return
        message = (data.get("message") or "").strip()
        if not message:
            return
        await sync_to_async(self._handle, thread_sensitive=False)(message)

    def _get_or_create_conversation(self):
        if self.conversation_id and self.conversation_id != "new":
            try:
                return ChatConversation.objects.get(pk=self.conversation_id, user=self.user)
            except (ChatConversation.DoesNotExist, ValueError):
                pass
        conversation = ChatConversation.objects.create(user=self.user)
        self.conversation_id = str(conversation.id)
        return conversation

    def _handle(self, message):
        conversation = self._get_or_create_conversation()
        ChatMessage.objects.create(conversation=conversation, role=ChatMessage.Role.USER, content=message)
        async_to_sync(self.send)(text_data=json.dumps({"type": "conversation", "id": conversation.id}))

        outils, contexte = route_and_call(message)
        async_to_sync(self.send)(text_data=json.dumps({"type": "outils", "outils": outils}))

        historique = [
            {"role": m.role.lower(), "content": m.content}
            for m in conversation.messages.order_by("created_at")[:40]
        ]

        config = AgentConfig.get_solo()
        full = ""
        try:
            for chunk in stream_chat(historique, contexte, model=config.modele("chat")):
                full += chunk
                async_to_sync(self.send)(text_data=json.dumps({"type": "token", "content": chunk}))
        except OllamaGenerationError as exc:
            async_to_sync(self.send)(text_data=json.dumps({"type": "erreur", "content": str(exc)}))
            return

        ChatMessage.objects.create(
            conversation=conversation, role=ChatMessage.Role.ASSISTANT, content=full, outils_utilises=outils,
        )
        if not conversation.titre:
            conversation.titre = message[:60]
            conversation.save(update_fields=["titre"])

        async_to_sync(self.send)(text_data=json.dumps({"type": "done"}))
