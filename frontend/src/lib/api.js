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

export async function generateMailApercu({ employeeId, sujetDemande, promptOverride }) {
  const { data } = await api.post('/api/mails/apercu/', {
    employee_id: employeeId,
    sujet_demande: sujetDemande,
    prompt_override: promptOverride || undefined,
  })
  return data
}
