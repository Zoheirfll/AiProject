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
  return fallback
}
