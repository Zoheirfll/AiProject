import os
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR.parent / ".env")

SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-key")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "channels",
    "django_apscheduler",
    "accounts",
    "core",
    "employees",
    "agents",
    "integrations",
    "automatisations",
    "dashboard",
    "n8n_integration",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", default="grh_auto"),
        "USER": env("POSTGRES_USER", default="grh_auto"),
        "PASSWORD": env("POSTGRES_PASSWORD", default="grh_auto"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [env("REDIS_URL", default="redis://localhost:6379/0")],
        },
    },
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Algiers"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"]
)
# Required so the browser sends/receives the sessionid + csrftoken cookies
# on cross-origin XHR/fetch calls from the Vite dev server (port 5173) to
# the API (port 8000) — both are localhost, different ports.
CORS_ALLOW_CREDENTIALS = True
# Django's CSRF middleware checks the Origin header against this list for
# any unsafe (POST/PUT/PATCH/DELETE) request — separate from, and just as
# required as, CORS_ALLOWED_ORIGINS above. Missing this causes every
# authenticated write (including login/logout) to fail with a raw
# "CSRF Failed: Origin checking failed" error.
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS", default=["http://localhost:5173", "http://127.0.0.1:5173"]
)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# Session-cookie auth (not token-in-localStorage) so the API is protected
# the same way Django admin is: httponly cookie, CSRF-protected writes.
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=60 * 60 * 8)  # 8h

# Ollama / LangChain
OLLAMA_BASE_URL = env("OLLAMA_BASE_URL", default="http://localhost:11434")
OLLAMA_MODEL = env("OLLAMA_MODEL", default="llama3")
# Smaller/faster model used for document-surveillance analysis (TacheSurveillance),
# which sends larger inputs than mail generation — keep it snappy on CPU-only setups.
OLLAMA_SURVEILLANCE_MODEL = env("OLLAMA_SURVEILLANCE_MODEL", default="qwen2.5:1.5b")

# LLM provider switch: "ollama" (default, local-only, Loi 18/07 compliant) or
# "groq" (Groq cloud API — TEMPORARY stand-in while no local server is available;
# sends HR data outside national territory, revert to "ollama" once a server exists).
LLM_PROVIDER = env("LLM_PROVIDER", default="ollama")
GROQ_API_KEY = env("GROQ_API_KEY", default="")
GROQ_BASE_URL = env("GROQ_BASE_URL", default="https://api.groq.com/openai/v1")
GROQ_MODEL = env("GROQ_MODEL", default="llama-3.3-70b-versatile")

# n8n (dashboard health check — reached by Docker service name inside the Compose network)
N8N_URL = env("N8N_INTERNAL_URL", default="http://n8n:5678")
# US-E7-02: static bearer token n8n workflows use to call /api/n8n/* — .env only, never hardcoded.
N8N_API_TOKEN = env("N8N_API_TOKEN", default="")

# Logs techniques (US-E8-02): un handler écrit en DB (TechnicalLog, consultable
# via /logs), un autre en fichier avec rotation quotidienne.
LOGS_DIR = BASE_DIR / "logs"
os.makedirs(LOGS_DIR, exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "filename": str(LOGS_DIR / "grh-auto.log"),
            "when": "midnight",
            "backupCount": 14,
            "formatter": "standard",
        },
        "database": {
            "class": "core.logging_handlers.DatabaseLogHandler",
            "formatter": "standard",
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "grh_auto": {
            "handlers": ["console", "file", "database"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# Email (SMTP Gmail)
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
