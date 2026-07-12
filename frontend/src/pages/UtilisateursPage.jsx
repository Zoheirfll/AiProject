import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, deleteUser, fetchUsers, updateUser } from '../lib/api'
import { describeApiError } from '../lib/errors'
import { useAuth } from '../lib/AuthContext'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PlusIcon,
  Select,
  Spinner,
  Toast,
  TrashIcon,
  UsersIcon,
} from '../lib/ui'

const ROLE_LABEL = { DRH: 'DRH', CHARGE_RH: 'Chargé RH' }

const emptyForm = { username: '', email: '', password: '', role: 'CHARGE_RH' }

// Local helper: DRF field-validation errors come back as
// {field: ["msg", ...], ...} — surface them right under the relevant Field
// instead of only a generic toast. describeApiError() (lib/errors.js)
// already produces a joined summary for the toast; this just re-derives
// the per-field mapping from the same response shape.
function fieldErrorsFrom(err) {
  const data = err?.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const out = {}
  for (const [field, messages] of Object.entries(data)) {
    if (field === 'detail' || !Array.isArray(messages)) continue
    out[field] = messages.filter((m) => typeof m === 'string').join(' ')
  }
  return out
}

function initials(name) {
  if (!name) return '?'
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_TONES = [
  'bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300',
  'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
]

function avatarTone(seed) {
  let hash = 0
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_TONES.length
  return AVATAR_TONES[hash]
}

function Avatar({ name }) {
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10 ${avatarTone(name)}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}

// Styled active/inactive switch — no dedicated Switch primitive exists in
// lib/ui.jsx yet, so this is a self-contained toggle built from a single
// accessible <button role="switch">, kept local to this page.
function ActiveSwitch({ checked, disabled, onChange, id }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={checked ? 'Compte actif — cliquer pour désactiver' : 'Compte désactivé — cliquer pour activer'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-accent-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <Badge tone={checked ? 'success' : 'neutral'}>{checked ? 'Actif' : 'Désactivé'}</Badge>
    </div>
  )
}

function CreateUserModal({ open, onClose, onSubmit, isPending, error, fieldErrors }) {
  const [form, setForm] = useState(emptyForm)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  const handleClose = () => {
    setForm(emptyForm)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nouveau compte">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nom d'utilisateur">
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            autoComplete="off"
            required
          />
          {fieldErrors.username && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{fieldErrors.username}</p>
          )}
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="off"
            required
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{fieldErrors.email}</p>
          )}
        </Field>
        <Field label="Mot de passe" hint="Au moins 8 caractères, pas uniquement numérique, pas trop courant.">
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
            required
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{fieldErrors.password}</p>
          )}
        </Field>
        <Field label="Rôle">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="CHARGE_RH">Chargé RH</option>
            <option value="DRH">DRH</option>
          </Select>
          {fieldErrors.role && (
            <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{fieldErrors.role}</p>
          )}
        </Field>

        {error && <Toast tone="error" message={error} onDismiss={() => {}} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={handleClose}>Annuler</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Spinner />} {isPending ? 'Création…' : 'Créer le compte'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function UtilisateursPage() {
  const { user: currentUser } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const queryClient = useQueryClient()

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setModalOpen(false)
      invalidate()
      setToast({ message: 'Compte créé avec succès.', tone: 'success' })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => updateUser(id, { is_active }),
    onSuccess: () => {
      invalidate()
      setToast({ message: 'Compte mis à jour.', tone: 'success' })
    },
    onError: (err) => setToast({ message: describeApiError(err, 'Échec de la mise à jour.'), tone: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      invalidate()
      setToast({ message: 'Compte supprimé.', tone: 'success' })
    },
    onError: (err) => setToast({ message: describeApiError(err, 'Échec de la suppression.'), tone: 'error' }),
  })

  const users = usersQuery.data ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <PageHeader
        title="Utilisateurs"
        description="Comptes DRH et Chargé RH — création et gestion des accès."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <PlusIcon /> Nouveau compte
          </Button>
        }
      />

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}

      <CreateUserModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          createMutation.reset()
        }}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
        error={createMutation.isError ? describeApiError(createMutation.error, 'Échec de la création du compte.') : ''}
        fieldErrors={createMutation.isError ? fieldErrorsFrom(createMutation.error) : {}}
      />

      <Card padded={false}>
        {usersQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : users.length === 0 ? (
          <div className="p-2">
            <EmptyState
              title="Aucun compte"
              description="Créez le premier compte DRH ou Chargé RH pour commencer."
              action={
                <Button onClick={() => setModalOpen(true)}>
                  <PlusIcon /> Nouveau compte
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">Utilisateur</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Rôle</th>
                  <th className="px-5 py-3 font-medium">Statut</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60 dark:border-slate-700/60 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.username} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                              <span className="truncate">{u.username}</span>
                              {isSelf && <Badge tone="primary">vous</Badge>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{u.email}</td>
                      <td className="px-5 py-3">
                        <Badge tone={u.role === 'DRH' ? 'primary' : 'neutral'}>{ROLE_LABEL[u.role] || u.role}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <ActiveSwitch
                          id={`active-${u.id}`}
                          checked={u.is_active}
                          disabled={isSelf || toggleActiveMutation.isPending}
                          onChange={(next) => toggleActiveMutation.mutate({ id: u.id, is_active: next })}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isSelf ? (
                          <IconButton
                            label="Suppression impossible pour votre propre compte"
                            disabled
                            className="opacity-30"
                          >
                            <TrashIcon />
                          </IconButton>
                        ) : (
                          <IconButton
                            label={`Supprimer le compte ${u.username}`}
                            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            onClick={() => {
                              if (confirm(`Supprimer le compte "${u.username}" ? Cette action est irréversible.`)) {
                                deleteMutation.mutate(u.id)
                              }
                            }}
                          >
                            <TrashIcon />
                          </IconButton>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {users.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <UsersIcon className="h-3.5 w-3.5" /> {users.length} compte{users.length > 1 ? 's' : ''} au total
        </p>
      )}
    </div>
  )
}
