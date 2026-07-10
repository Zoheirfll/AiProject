import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

export async function uploadExcelImport(file) {
  const formData = new FormData()
  formData.append('fichier', file)
  const { data } = await api.post('/api/imports/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function fetchImportHistory() {
  const { data } = await api.get('/api/imports/historique/')
  return data
}

export async function fetchEmployees(params = {}) {
  const { data } = await api.get('/api/employes/', { params })
  return data
}

export async function generateMailApercu({
  employeeId,
  destinataireNom,
  destinataireEmail,
  sujetDemande,
  promptOverride,
}) {
  const { data } = await api.post('/api/mails/apercu/', {
    employee_id: employeeId || undefined,
    destinataire_nom: destinataireNom || undefined,
    destinataire_email: destinataireEmail || undefined,
    sujet_demande: sujetDemande,
    prompt_override: promptOverride || undefined,
  })
  return data
}

export async function envoyerMail({ mailLogId, subject, body }) {
  const { data } = await api.post('/api/mails/envoyer/', {
    mail_log_id: mailLogId,
    subject,
    body,
  })
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

export async function testRegle(id) {
  const { data } = await api.post(`/api/automatisations/${id}/test/`)
  return data
}
