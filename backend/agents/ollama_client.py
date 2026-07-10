import re

import ollama
from django.conf import settings

DEFAULT_MAIL_PROMPT = (
    "Tu es un assistant RH. Rédige un email professionnel en français pour "
    "l'employé suivant, sur le sujet indiqué. Réponds strictement au format:\n"
    "SUJET: <objet du mail>\n"
    "CORPS:\n<corps du mail>"
)

DEFAULT_MAIL_PROMPT_HTML = (
    "Tu es un assistant RH. Rédige un email professionnel en français pour "
    "l'employé suivant, sur le sujet indiqué. Le corps doit être du HTML simple "
    "et bien mis en forme (balises <p>, <h2>, <strong>, quelques couleurs sobres "
    "en style inline), prêt à être envoyé tel quel comme corps HTML d'un email. "
    "Réponds strictement au format:\n"
    "SUJET: <objet du mail>\n"
    "CORPS:\n<corps du mail en HTML>"
)


class OllamaGenerationError(Exception):
    pass


def _client():
    return ollama.Client(host=settings.OLLAMA_BASE_URL)


def generate_mail_content(employee, sujet_demande, prompt_override=None, format="TEXTE"):
    """Ask the local Ollama model to draft a subject + body for an HR email.

    format: "TEXTE" (default) or "HTML" — selects the default system prompt
    (ignored if prompt_override is given, which is assumed to already match
    the desired format — US-E4-02 template selection).

    Returns {"subject": str, "body": str}. Raises OllamaGenerationError on
    failure (model missing, Ollama unreachable, unparsable response).
    """
    default_prompt = DEFAULT_MAIL_PROMPT_HTML if format == "HTML" else DEFAULT_MAIL_PROMPT
    prompt = prompt_override or default_prompt
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
    # Local CPU inference is slow on modest hardware — keep the input small
    # and cap the output length so a single analysis finishes in a
    # reasonable time instead of running for several minutes.
    contenu_tronque = contenu[:2000]

    try:
        response = _client().chat(
            model=settings.OLLAMA_SURVEILLANCE_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": contenu_tronque},
            ],
            options={"num_predict": 150},
        )
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"Ollama injoignable ou modèle absent: {exc}") from exc

    content = response.get("message", {}).get("content", "").strip()
    return _parse_analysis_response(content, forcer_envoi)


def _parse_analysis_response(content, forcer_envoi):
    envoyer = forcer_envoi
    subject = "Sans objet"
    body = ""

    # Models sometimes format "LABEL :" with a space before the colon
    # (common in French output) — normalize before matching.
    content = re.sub(r"\b(ENVOYER|SUJET|CORPS)\s*:", r"\1:", content, flags=re.IGNORECASE)

    first_line, _, rest = content.partition("\n")
    if first_line.upper().startswith("ENVOYER:"):
        decision = first_line.split(":", 1)[1].strip().upper()
        envoyer = forcer_envoi or decision.startswith("OUI")
        content = rest

    if re.search(r"SUJET:", content, re.IGNORECASE) and re.search(r"CORPS:", content, re.IGNORECASE):
        before, after = re.split(r"CORPS:", content, maxsplit=1, flags=re.IGNORECASE)
        subject = re.split(r"SUJET:", before, maxsplit=1, flags=re.IGNORECASE)[1].strip() or subject
        body = after.strip()
    else:
        body = content.strip()

    if envoyer and not body:
        raise OllamaGenerationError("Réponse du modèle vide ou non exploitable.")

    return {"envoyer": envoyer, "subject": subject, "body": body}
