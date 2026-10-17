import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, ShieldCheck, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { createDoorStaff, setDoorStaffActive, subscribeDoorStaff } from '@/services/users'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/misc'
import { Dialog, useConfirm } from '@/components/ui/dialog'

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'That email already has an account. Use a different one.',
  'auth/invalid-email': 'Enter a valid email.',
  'auth/weak-password': 'Password must be at least 6 characters.',
}

function makePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => chars[b % chars.length]).join('')
}

export default function DoorStaff() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { data: staff = [] } = useSubscription((ok, err) => subscribeDoorStaff(user.uid, ok, err), [user.uid], { initial: [] })
  const [form, setForm] = useState({ displayName: '', email: '', password: makePassword() })
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const door = staff.filter((s) => s.role === 'door' || s.role === 'revoked')

  async function create(e) {
    e.preventDefault()
    if (form.displayName.trim().length < 2) return toast.error('Add a name, e.g. "Main gate"')
    setSaving(true)
    try {
      await createDoorStaff({ ...form, email: form.email.trim(), displayName: form.displayName.trim() }, user)
      setCreated({ ...form, email: form.email.trim() })
      setForm({ displayName: '', email: '', password: makePassword() })
    } catch (err) {
      toast.error(AUTH_ERRORS[err.code] || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggle(s) {
    const active = s.role !== 'door'
    if (!active && !(await confirm({ title: `Remove ${s.displayName}’s access?`, description: 'They’ll be signed out of the scanner straight away. You can turn it back on later.', confirmLabel: 'Remove access', danger: true }))) return
    await setDoorStaffActive(s.id, active)
    toast.success(active ? 'Access restored' : 'Access removed')
  }

  const credentials = created && `UniVibe door login\n${window.location.origin}/organizer\nEmail: ${created.email}\nPassword: ${created.password}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader title="Door staff" description="Scanner-only accounts for volunteers at the entrance. They can check tickets in for your events, nothing else." />
        {door.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No door staff yet" description="Add one for each person scanning tickets." className="m-5" />
        ) : (
          <ul className="divide-y">
            {door.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="grid size-9 place-items-center rounded-full bg-muted text-sm font-bold uppercase">{s.displayName[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <Badge variant={s.role === 'door' ? 'success' : 'outline'}>{s.role === 'door' ? 'Active' : 'Removed'}</Badge>
                <Button size="sm" variant="ghost" onClick={() => toggle(s)}>{s.role === 'door' ? 'Remove' : 'Restore'}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="self-start">
        <CardHeader title="Add door staff" />
        <form onSubmit={create} className="space-y-3 p-5">
          <Field label="Name" hint="Shown in the activity log, e.g. “Main gate – Brian”">{(p) => <Input {...p} value={form.displayName} onChange={set('displayName')} />}</Field>
          <Field label="Email (their login)">{(p) => <Input {...p} type="email" required value={form.email} onChange={set('email')} />}</Field>
          <Field label="Password" hint="Generated for you. You’ll see it once after creating.">{(p) => <Input {...p} value={form.password} onChange={set('password')} className="font-mono" minLength={6} required />}</Field>
          <Button type="submit" loading={saving} className="w-full">
            {!saving && <UserPlus />} Create login
          </Button>
        </form>
      </Card>

      <Dialog
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        title="Door login created"
        description="Send these details to the volunteer. The password won’t be shown again."
        size="sm"
        footer={
          <Button onClick={() => navigator.clipboard.writeText(credentials).then(() => toast.success('Copied'))}>
            <Copy /> Copy login details
          </Button>
        }
      >
        <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">{credentials}</pre>
      </Dialog>
    </div>
  )
}
