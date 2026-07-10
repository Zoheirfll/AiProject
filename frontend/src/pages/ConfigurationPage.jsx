import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchAutomatisationConfig, saveAutomatisationConfig } from '../lib/api'
import { Button, Card, Field, PageHeader, Spinner, Textarea, Toast } from '../lib/ui'

export default function ConfigurationPage() {
  const [prompt, setPrompt] = useState('')
  const [heure, setHeure] = useState('09:00')
  const [saved, setSaved] = useState(false)

  const configQuery = useQuery({ queryKey: ['automatisations-config'], queryFn: fetchAutomatisationConfig })

  useEffect(() => {
    if (configQuery.data) {
      setPrompt(configQuery.data.prompt_global || '')
      setHeure((configQuery.data.heure_rapport_quotidien || '09:00').slice(0, 5))
    }
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: saveAutomatisationConfig,
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <PageHeader
        title="Configuration"
        description="Prompt Ollama global et horaire du rapport quotidien — utilisés par les automatisations."
      />

      {configQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Spinner /> Chargement…</div>
      ) : (
        <Card className="space-y-5">
          <Field
            label="Prompt Ollama global"
            hint="Utilisé par défaut pour le rapport quotidien et pour toute règle sans prompt spécifique. Variables disponibles : {{nom}}, {{departement}}, {{date_fin}}, {{jours_restants}}."
          >
            <Textarea
              className="min-h-[160px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Tu es un assistant RH. Rédige..."
            />
          </Field>

          <Field label="Heure du rapport quotidien">
            <input
              type="time"
              className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <Button
              onClick={() => saveMutation.mutate({ prompt_global: prompt, heure_rapport_quotidien: heure })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Spinner />}
              Enregistrer
            </Button>
            {saved && <span className="text-sm text-emerald-600">Configuration enregistrée.</span>}
          </div>
        </Card>
      )}

      {saveMutation.isError && (
        <Toast tone="error" message="Échec de l'enregistrement de la configuration." onDismiss={() => {}} />
      )}
    </div>
  )
}
