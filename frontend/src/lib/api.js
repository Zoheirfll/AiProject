import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
})

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete'])

api.interceptors.request.use((config) => {
  if (UNSAFE_METHODS.has((config.method || '').toLowerCase())) {
    const token = readCookie('csrftoken')
    if (token) config.headers['X-CSRFToken'] = token
  }
  return config
})

export async function fetchCsrf() {
  await api.get('/api/auth/csrf/')
}

export async function login(username, password) {
  const { data } = await api.post('/api/auth/login/', { username, password })
  return data
}

export async function logout() {
  await api.post('/api/auth/logout/')
}

export async function fetchMe() {
  const { data } = await api.get('/api/auth/me/')
  return data
}

export async function uploadExcelImport(file, onUploadProgress) {
  const formData = new FormData()
  formData.append('fichier', file)
  const { data } = await api.post('/api/imports/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
  return data
}

export async function fetchImportHistory() {
  const { data } = await api.get('/api/imports/historique/')
  return data
}

export async function deleteImport(id) {
  await api.delete(`/api/imports/${id}/`)
}

export async function fetchImportMapping() {
  const { data } = await api.get('/api/imports/mapping/')
  return data
}

export async function saveImportMapping(payload) {
  const { data } = await api.put('/api/imports/mapping/', payload)
  return data
}

export async function fetchEmployeesPage(params = {}) {
  const { data } = await api.get('/api/employes/', { params })
  return data
}

export async function fetchEmployees(params = {}) {
  const { data } = await api.get('/api/employes/', { params: { page_size: 1000, ...params } })
  return data.results ?? data
}

export async function generateMailApercu({
  employeeId,
  destinataireNom,
  destinataireEmail,
  sujetDemande,
  promptOverride,
  format,
}) {
  const { data } = await api.post('/api/mails/apercu/', {
    employee_id: employeeId || undefined,
    destinataire_nom: destinataireNom || undefined,
    destinataire_email: destinataireEmail || undefined,
    sujet_demande: sujetDemande,
    prompt_override: promptOverride || undefined,
    format: format || undefined,
  })
  return data
}

export async function envoyerMail({ mailLogId, subject, body, format }) {
  const { data } = await api.post('/api/mails/envoyer/', {
    mail_log_id: mailLogId,
    subject,
    body,
    format,
  })
  return data
}

export async function generateMailApercuMasse({ file, sujetDemande, promptOverride, format }) {
  const formData = new FormData()
  formData.append('fichier', file)
  if (sujetDemande) formData.append('sujet_demande', sujetDemande)
  if (promptOverride) formData.append('prompt_override', promptOverride)
  if (format) formData.append('format', format)
  const { data } = await api.post('/api/mails/apercu-masse/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function envoyerMailsMasse(mails) {
  const { data } = await api.post('/api/mails/envoyer-masse/', { mails })
  return data
}

export async function fetchMailHistorique(params = {}) {
  const { data } = await api.get('/api/mails/historique/', { params })
  return data
}

export async function testerSmtp() {
  const { data } = await api.post('/api/config/smtp/test/')
  return data
}

export async function fetchRegles() {
  const { data } = await api.get('/api/automatisations/')
  return data
}

export async function createRegle(payload) {
  const { data } = await api.post('/api/automatisations/', payload)
  return data
}

export async function updateRegle(id, payload) {
  const { data } = await api.put(`/api/automatisations/${id}/`, payload)
  return data
}

export async function deleteRegle(id) {
  await api.delete(`/api/automatisations/${id}/`)
}

export async function runRegle(id) {
  const { data } = await api.post(`/api/automatisations/${id}/run/`)
  return data
}

export async function testRegle(id, testEmail) {
  const { data } = await api.post(`/api/automatisations/${id}/test/`, {
    test_email: testEmail || undefined,
  })
  return data
}

export async function fetchRegleApercu(id) {
  const { data } = await api.get(`/api/automatisations/${id}/apercu/`)
  return data
}

export async function fetchRegleHistorique(id) {
  const { data } = await api.get(`/api/automatisations/${id}/historique/`)
  return data
}

export async function fetchAutomatisationConfig() {
  const { data } = await api.get('/api/automatisations/config/')
  return data
}

export async function saveAutomatisationConfig(payload) {
  const { data } = await api.put('/api/automatisations/config/', payload)
  return data
}

export async function fetchTaches() {
  const { data } = await api.get('/api/surveillance/')
  return data
}

export async function createTache(payload) {
  const formData = new FormData()
  formData.append('nom', payload.nom)
  formData.append('actif', payload.actif)
  formData.append('fichier', payload.fichier)
  formData.append('frequence', payload.frequence)
  formData.append('heure_quotidienne', payload.heure_quotidienne)
  formData.append('prompt_analyse', payload.prompt_analyse)
  formData.append('mode_envoi', payload.mode_envoi)
  formData.append('destinataires', JSON.stringify(payload.destinataires))
  formData.append('cc', JSON.stringify(payload.cc))
  formData.append('bcc', JSON.stringify(payload.bcc))
  const { data } = await api.post('/api/surveillance/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteTache(id) {
  await api.delete(`/api/surveillance/${id}/`)
}

export async function runTache(id) {
  const { data } = await api.post(`/api/surveillance/${id}/run/`)
  return data
}

export async function testTache(id) {
  const { data } = await api.post(`/api/surveillance/${id}/test/`)
  return data
}

export async function fetchTacheHistorique(tacheId) {
  const { data } = await api.get('/api/surveillance/historique/', { params: { tache: tacheId } })
  return data
}

export async function fetchDashboardKpis() {
  const { data } = await api.get('/api/dashboard/kpis/')
  return data
}

export async function fetchMailsEvolution(jours = 30) {
  const { data } = await api.get('/api/dashboard/mails-evolution/', { params: { jours } })
  return data
}

export async function fetchAutomatisationsTypes() {
  const { data } = await api.get('/api/dashboard/automatisations-types/')
  return data
}

export async function fetchContratsParMois() {
  const { data } = await api.get('/api/dashboard/contrats-par-mois/')
  return data
}

export async function fetchActiviteRecente(limite = 20) {
  const { data } = await api.get('/api/dashboard/activite/', { params: { limite } })
  return data
}

export async function fetchUsers() {
  const { data } = await api.get('/api/users/')
  return data
}

export async function createUser(payload) {
  const { data } = await api.post('/api/users/', payload)
  return data
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`/api/users/${id}/`, payload)
  return data
}

export async function deleteUser(id) {
  await api.delete(`/api/users/${id}/`)
}

export async function fetchAgentAnalyses() {
  const { data } = await api.get('/api/agents/analyses/')
  return data
}

export async function lancerAnalyse() {
  const { data } = await api.post('/api/agents/analyses/lancer/')
  return data
}

export async function fetchAgentConfig() {
  const { data } = await api.get('/api/agents/config/')
  return data
}

export async function saveAgentConfig(payload) {
  const { data } = await api.put('/api/agents/config/', payload)
  return data
}

export async function fetchModelesDisponibles() {
  const { data } = await api.get('/api/agents/config/modeles-disponibles/')
  return data
}

export async function fetchChatSuggestions() {
  const { data } = await api.get('/api/agents/chat/suggestions/')
  return data
}

export async function fetchConversations() {
  const { data } = await api.get('/api/agents/chat/conversations/')
  return data
}

export async function fetchConversationMessages(id) {
  const { data } = await api.get(`/api/agents/chat/conversations/${id}/messages/`)
  return data
}

export async function fetchWorkflowDefinitions() {
  const { data } = await api.get('/api/agents/workflows/')
  return data
}

export async function lancerWorkflow(payload) {
  const { data } = await api.post('/api/agents/workflows/lancer/', payload)
  return data
}

export async function lancerWorkflowPersonnalise(payload) {
  const { data } = await api.post('/api/agents/workflows/personnalise/', payload)
  return data
}

export async function fetchWorkflowExecutions() {
  const { data } = await api.get('/api/agents/workflows/executions/')
  return data
}

export async function reprendreWorkflow(id) {
  const { data } = await api.post(`/api/agents/workflows/executions/${id}/reprendre/`)
  return data
}
