// Django/DRF internals leak through as `detail` with the exact same JSON
// shape as our own friendly application errors (CSRF failures, auth/perm
// checks that fire before a view runs, malformed-body parse errors...).
// Our own messages are always French; these are the recognizable English
// technical ones that must never reach the user verbatim.
const TECHNICAL_PATTERNS = [
  /^CSRF Failed/i,
  /^Authentication credentials/i,
  /^You do not have permission/i,
  /^Malformed request/i,
  /JSON parse error/i,
  /^Method .* not allowed/i,
  /^Not found/i,
]

function looksTechnical(message) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message))
}

// Extracts a safe-to-display message from an axios error: our own backend
// `detail` strings are shown as-is (they're already French and friendly),
// but recognizable Django/DRF internals and anything else fall back to a
// generic message instead of leaking raw technical text.
export function describeApiError(err, fallback = 'Une erreur est survenue.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail && !looksTechnical(detail)) {
    return detail
  }
  if (!err?.response) {
    return 'Impossible de contacter le serveur. Vérifiez votre connexion.'
  }
  const fieldMessage = describeFieldErrors(err)
  if (fieldMessage) return fieldMessage
  return fallback
}

// DRF serializer validation errors come back as {field: ["msg", ...], ...}
// with no top-level `detail` at all — e.g. {"password": ["Ce mot de passe
// est trop courant."]}. These are our own serializers' messages (already
// French, safe to show), so surface them instead of a useless generic
// fallback. Returns null if the shape doesn't look like field errors.
function describeFieldErrors(err) {
  const data = err?.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const parts = []
  for (const [field, messages] of Object.entries(data)) {
    if (field === 'detail' || !Array.isArray(messages)) continue
    for (const message of messages) {
      if (typeof message === 'string') parts.push(message)
    }
  }
  return parts.length > 0 ? parts.join(' ') : null
}
