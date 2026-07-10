import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createUser, deleteUser, fetchUsers, updateUser } from '../lib/api'
import { describeApiError } from '../lib/errors'
import { useAuth } from '../lib/AuthContext'
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
} from '../lib/ui'

const ROLE_LABEL = { DRH: 'DRH', CHARGE_RH: 'Chargé RH' }

const emptyForm = { username: '', email: '', password: '', role: 'CHARGE_RH' }

function CreateUserModal({ open, onClose, onSubmit, isPending, error }) {
  const [form, setForm] = useState(emptyForm)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau compte">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nom d'utilisateur">
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field label="Mot de passe" hint="Au moins 8 caractères, pas uniquement numérique.">
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Rôle">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="CHARGE_RH">Chargé RH</option>
            <option value="DRH">DRH</option>
          </Select>
        </Field>

        {error && <Toast tone="error" message={error} onDismiss={() => {}} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
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
      />

      <Card padded={false}>
        {usersQuery.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-400"><Spinner /> Chargement…</div>
        ) : usersQuery.data?.length === 0 ? (
          <EmptyState title="Aucun compte" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-5 py-3 font-medium">Nom d'utilisateur</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Rôle</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {usersQuery.data?.map((u) => {
                const isSelf = u.id === currentUser?.id
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {u.username} {isSelf && <span className="text-xs text-slate-400">(vous)</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{u.email}</td>
                    <td className="px-5 py-3">
                      <Badge tone={u.role === 'DRH' ? 'primary' : 'neutral'}>{ROLE_LABEL[u.role] || u.role}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Checkbox
                        label={u.is_active ? 'Actif' : 'Désactivé'}
                        checked={u.is_active}
                        disabled={isSelf || toggleActiveMutation.isPending}
                        onChange={(e) =>
                          toggleActiveMutation.mutate({ id: u.id, is_active: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isSelf && (
                        <IconButton
                          label="Supprimer"
                          className="hover:bg-red-50 hover:text-red-600"
                          onClick={() => {
                            if (confirm(`Supprimer le compte "${u.username}" ?`)) deleteMutation.mutate(u.id)
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
        )}
      </Card>
    </div>
  )
}
