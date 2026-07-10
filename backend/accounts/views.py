from datetime import timedelta

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LoginAttempt
from .serializers import UserSerializer

MAX_TENTATIVES = 5
FENETRE_VERROUILLAGE = timedelta(minutes=15)


def _tentatives_recentes(username):
    seuil = timezone.now() - FENETRE_VERROUILLAGE
    return LoginAttempt.objects.filter(username=username, echoue_le__gte=seuil).count()


class CsrfView(APIView):
    """GET this once before logging in — sets the csrftoken cookie the
    frontend then echoes back as X-CSRFToken on POST/PUT/DELETE."""

    permission_classes = [AllowAny]

    def get(self, request):
        get_token(request)
        return Response({"detail": "ok"})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""

        if not username or not password:
            return Response({"detail": "Nom d'utilisateur et mot de passe requis."}, status=400)

        if _tentatives_recentes(username) >= MAX_TENTATIVES:
            return Response(
                {"detail": "Trop de tentatives échouées. Réessayez dans 15 minutes."}, status=429
            )

        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active:
            LoginAttempt.objects.create(username=username)
            return Response({"detail": "Identifiants invalides."}, status=401)

        LoginAttempt.objects.filter(username=username).delete()
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=204)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
