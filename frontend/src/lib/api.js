import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

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
