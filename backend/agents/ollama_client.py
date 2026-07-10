import ollama
from django.conf import settings

DEFAULT_MAIL_PROMPT = (
    "Tu es un assistant RH. Rédige un email professionnel en français pour "
    "l'employé suivant, sur le sujet indiqué. Réponds strictement au format:\n"
    "SUJET: <objet du mail>\n"
    "CORPS:\n<corps du mail>"
)


class OllamaGenerationError(Exception):
    pass


def _client():
    return ollama.Client(host=settings.OLLAMA_BASE_URL)


def generate_mail_content(employee, sujet_demande, prompt_override=None):
    """Ask the local Ollama model to draft a subject + body for an HR email.

    Returns {"subject": str, "body": str}. Raises OllamaGenerationError on
    failure (model missing, Ollama unreachable, unparsable response).
    """
    prompt = prompt_override or DEFAULT_MAIL_PROMPT
    context = (
        f"Employé: {employee.prenom} {employee.nom} ({employee.poste or 'N/A'}, "
        f"{employee.departement or 'N/A'})\n"
        f"Sujet demandé: {sujet_demande}"
    )

    try:
        response = _client().chat(
            model=settings.OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": context},
            ],
        )
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"Ollama injoignable ou modèle absent: {exc}") from exc

    content = response.get("message", {}).get("content", "").strip()
    return _parse_mail_response(content)


def _parse_mail_response(content):
    subject = ""
    body = ""

    if "SUJET:" in content and "CORPS:" in content:
        before, after = content.split("CORPS:", 1)
        subject = before.split("SUJET:", 1)[1].strip()
        body = after.strip()
    else:
        lines = content.splitlines()
        subject = lines[0].strip() if lines else "Sans objet"
        body = "\n".join(lines[1:]).strip() or content

    if not subject:
        subject = "Sans objet"
    if not body:
        raise OllamaGenerationError("Réponse du modèle vide ou non exploitable.")

    return {"subject": subject, "body": body}
