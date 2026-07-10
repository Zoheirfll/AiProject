import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

django_asgi_app = get_asgi_application()

from agents.routing import websocket_urlpatterns as agents_ws_urlpatterns  # noqa: E402
from integrations.routing import websocket_urlpatterns as integrations_ws_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # AuthMiddlewareStack reads the Django session cookie so
        # self.scope["user"] is populated in consumers (needed by
        # agents.consumers.ChatConsumer to scope conversations per user).
        "websocket": AuthMiddlewareStack(
            URLRouter(integrations_ws_urlpatterns + agents_ws_urlpatterns)
        ),
    }
)
