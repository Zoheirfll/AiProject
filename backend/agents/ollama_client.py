import json
import re

import ollama
import requests
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


def _default_model():
    return settings.GROQ_MODEL if settings.LLM_PROVIDER == "groq" else settings.OLLAMA_MODEL


def _default_surveillance_model():
    return settings.GROQ_MODEL if settings.LLM_PROVIDER == "groq" else settings.OLLAMA_SURVEILLANCE_MODEL


def _analysis_max_tokens():
    # 150 keeps local CPU inference (Ollama) fast; Groq is fast regardless
    # of output length, so that cap only served to truncate responses
    # mid-sentence there — give it more room.
    return 600 if settings.LLM_PROVIDER == "groq" else 150


def _groq_request(model, messages, options=None, stream=False):
    max_tokens = (options or {}).get("num_predict")
    payload = {"model": model, "messages": messages, "stream": stream}
    if max_tokens:
        payload["max_tokens"] = max_tokens
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"

    if not stream:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()

    def _gen():
        with requests.post(url, json=payload, headers=headers, timeout=120, stream=True) as response:
            response.raise_for_status()
            for raw_line in response.iter_lines():
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8")
                if not line.startswith("data:"):
                    continue
                data_str = line[len("data:") :].strip()
                if data_str == "[DONE]":
                    break
                chunk = json.loads(data_str)
                token = chunk["choices"][0].get("delta", {}).get("content", "")
                if token:
                    yield token

    return _gen()


def _chat(model, messages, options=None):
    """Non-streaming chat completion via the configured LLM_PROVIDER (ollama/groq).

    Returns the response text, stripped.
    """
    if settings.LLM_PROVIDER == "groq":
        return _groq_request(model, messages, options=options, stream=False)
    response = _client().chat(model=model, messages=messages, options=options or {})
    return response.get("message", {}).get("content", "").strip()


def _stream_tokens(model, messages, options=None):
    """Streaming chat completion via the configured LLM_PROVIDER. Yields text tokens."""
    if settings.LLM_PROVIDER == "groq":
        yield from _groq_request(model, messages, options=options, stream=True)
        return
    stream = _client().chat(model=model, messages=messages, stream=True, options=options or {})
    for chunk in stream:
        token = chunk.get("message", {}).get("content", "")
        if token:
            yield token


def generate_mail_content(employee, sujet_demande, prompt_override=None, format="TEXTE", model=None):
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
        content = _chat(
            model or _default_model(),
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": context},
            ],
        )
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"LLM injoignable ou modèle absent: {exc}") from exc

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
    "{regle_envoi}"
)

REGLE_ENVOI_ANOMALIE = (
    "Mets ENVOYER: NON uniquement si rien d'anormal ou de notable n'a été trouvé "
    "et qu'aucun mail n'est nécessaire."
)

REGLE_ENVOI_TOUJOURS = (
    "Un rapport doit TOUJOURS être envoyé : mets ENVOYER: OUI dans tous les cas, "
    "et rédige SUJET/CORPS pour résumer le contenu du document même si rien "
    "d'anormal n'a été trouvé."
)


def analyser_document(prompt_analyse, contenu, forcer_envoi=False, model=None):
    """Ask Ollama to analyze a document's content against a watch instruction.

    Returns {"envoyer": bool, "subject": str, "body": str}. Raises
    OllamaGenerationError on failure (model missing, Ollama unreachable,
    unparsable response). When forcer_envoi is True, "envoyer" is always
    True regardless of what the model decided (used for periodic digests) —
    the prompt is also adjusted so the model actually drafts SUJET/CORPS
    instead of a bare "ENVOYER: NON" it wouldn't otherwise expand on.
    """
    regle_envoi = REGLE_ENVOI_TOUJOURS if forcer_envoi else REGLE_ENVOI_ANOMALIE
    system_prompt = DOCUMENT_ANALYSIS_PROMPT_TEMPLATE.format(
        consigne=prompt_analyse, regle_envoi=regle_envoi
    )
    # Local CPU inference is slow on modest hardware — keep the input small
    # and cap the output length so a single analysis finishes in a
    # reasonable time instead of running for several minutes.
    contenu_tronque = contenu[:2000]

    try:
        content = _chat(
            model or _default_surveillance_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": contenu_tronque},
            ],
            options={"num_predict": _analysis_max_tokens()},
        )
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"LLM injoignable ou modèle absent: {exc}") from exc

    return _parse_analysis_response(content, forcer_envoi)


CHAT_SYSTEM_PROMPT = (
    "Tu es l'assistant RH de GRH-Auto. Réponds en français, de façon concise et "
    "professionnelle. Utilise les données ci-dessous si elles sont pertinentes pour "
    "la question ; si elles ne suffisent pas pour répondre, dis-le clairement au lieu "
    "d'inventer une réponse.\n\nDonnées disponibles:\n{contexte}"
)


def stream_chat(historique, contexte=None, model=None, num_predict=400):
    """Yield response tokens from Ollama for a chat turn (US-E6-02 streaming).

    historique: list of {"role": "user"|"assistant", "content": str}, oldest
    first — the running conversation, ending with the latest user message.
    contexte: optional dict of tool-call results injected into the system
    prompt so the model can ground its answer in real data (US-E6-02
    "outils"/transparency — the caller reports which tools were used
    separately; this just gives the model their output as context).

    Yields str chunks. Raises OllamaGenerationError if Ollama is unreachable
    (raised before any chunk is yielded, or mid-stream on a transport error).
    """
    import json as _json

    system_prompt = CHAT_SYSTEM_PROMPT.format(
        contexte=_json.dumps(contexte, ensure_ascii=False, default=str) if contexte else "(aucune)"
    )
    messages = [{"role": "system", "content": system_prompt}, *historique]

    try:
        for token in _stream_tokens(
            model or _default_model(), messages, options={"num_predict": num_predict}
        ):
            yield token
    except OllamaGenerationError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"LLM injoignable ou modèle absent: {exc}") from exc


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
