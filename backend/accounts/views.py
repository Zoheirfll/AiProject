from datetime import timedelta

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LoginAttempt, User
from .permissions import IsDRH
from .serializers import UserCreateSerializer, UserSerializer

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


class UserListCreateView(ListCreateAPIView):
    """DRH-only: create/list accounts (an alternative to the create_hr_user
    management command, for day-to-day use without shell access)."""

    permission_classes = [IsDRH]
    queryset = User.objects.all().order_by("username")

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == "POST" else UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=201)


class UserDetailView(RetrieveUpdateDestroyAPIView):
    """DRH-only: toggle is_active/role or remove an account. A DRH can't
    deactivate or delete their own account (would lock everyone out if
    they're the only DRH)."""

    permission_classes = [IsDRH]
    queryset = User.objects.all()
    serializer_class = UserSerializer
    http_method_names = ["get", "patch", "delete"]

    def patch(self, request, *args, **kwargs):
        if int(kwargs["pk"]) == request.user.id and request.data.get("is_active") is False:
            return Response({"detail": "Vous ne pouvez pas désactiver votre propre compte."}, status=400)
        return super().patch(request, *args, **kwargs)

    def delete(self, request, *args, **kwargs):
        if int(kwargs["pk"]) == request.user.id:
            return Response({"detail": "Vous ne pouvez pas supprimer votre propre compte."}, status=400)
        return super().delete(request, *args, **kwargs)
