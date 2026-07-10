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


DOCUMENT_ANALYSIS_PROMPT_TEMPLATE = (
    "Tu es un assistant qui surveille un document pour une équipe RH. "
    "Consigne de surveillance: {consigne}\n\n"
    "Analyse le contenu fourni selon cette consigne. Réponds STRICTEMENT au format:\n"
    "ENVOYER: OUI ou NON\n"
    "SUJET: <objet du mail>\n"
    "CORPS:\n<corps du mail expliquant ce qui a été trouvé>\n\n"
    "Mets ENVOYER: NON uniquement si rien d'anormal ou de notable n'a été trouvé "
    "et qu'aucun mail n'est nécessaire."
)


def analyser_document(prompt_analyse, contenu, forcer_envoi=False):
    """Ask Ollama to analyze a document's content against a watch instruction.

    Returns {"envoyer": bool, "subject": str, "body": str}. Raises
    OllamaGenerationError on failure (model missing, Ollama unreachable,
    unparsable response). When forcer_envoi is True, "envoyer" is always
    True regardless of what the model decided (used for periodic digests).
    """
    system_prompt = DOCUMENT_ANALYSIS_PROMPT_TEMPLATE.format(consigne=prompt_analyse)
    # Ollama has a finite context window — truncate very large documents
    # rather than fail outright.
    contenu_tronque = contenu[:12000]

    try:
        response = _client().chat(
            model=settings.OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": contenu_tronque},
            ],
        )
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"Ollama injoignable ou modèle absent: {exc}") from exc

    content = response.get("message", {}).get("content", "").strip()
    return _parse_analysis_response(content, forcer_envoi)


def _parse_analysis_response(content, forcer_envoi):
    envoyer = forcer_envoi
    subject = "Sans objet"
    body = ""

    first_line, _, rest = content.partition("\n")
    if first_line.upper().startswith("ENVOYER:"):
        decision = first_line.split(":", 1)[1].strip().upper()
        envoyer = forcer_envoi or decision.startswith("OUI")
        content = rest

    if "SUJET:" in content and "CORPS:" in content:
        before, after = content.split("CORPS:", 1)
        subject = before.split("SUJET:", 1)[1].strip() or subject
        body = after.strip()
    else:
        body = content.strip()

    if envoyer and not body:
        raise OllamaGenerationError("Réponse du modèle vide ou non exploitable.")

    return {"envoyer": envoyer, "subject": subject, "body": body}
