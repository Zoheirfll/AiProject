from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .consumers import NotificationsConsumer


def notify(payload):
    """Broadcast a JSON-serializable payload to all connected WebSocket clients."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        NotificationsConsumer.GROUP_NAME,
        {"type": "notify", "payload": payload},
    )
