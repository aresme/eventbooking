import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, CircleDashed, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { DEFAULT_SETTINGS, saveSettings, subscribeSettings } from '@/services/settings'
import { changePassword } from '@/services/users'
import { saveClub, subscribeClub } from '@/services/clubs'
import { emailEnabled } from '@/services/email'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/form'
import { Card, CardHeader } from '@/components/ui/misc'

export default function Settings() {
  const { isAdmin } = useAuth()
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ClubProfile />
      {isAdmin && <SiteSettings />}
      <PasswordCard />
      <IntegrationStatus />
    </div>
  )
}

function ClubProfile() {
  const { user } = useAuth()
  const { data: club, loading } = useSubscription((ok, err) => subscribeClub(user.uid, ok, err), [user.uid])
  const [form, setForm] = useState({ name: '', bio: '', logo: '', website: '', instagram: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading) {
      setForm({
        name: club?.name || user.profile?.org || user.profile?.displayName || '',
        bio: club?.bio || '',
        logo: club?.logo || '',
        website: club?.website || '',
        instagram: club?.instagram || '',
      })
    }
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Add a club name')
    setSaving(true)
    try {
      await saveClub(user.uid, form)
      toast.success('Club page updated')
    } catch {
      toast.error('Could not save your club page')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Club page"
        description="Shown to students on your public page and on your events."
        action={
          <Button href={`/clubs/${user.uid}`} target="_blank" variant="ghost" size="sm">
            <ExternalLink /> View
          </Button>
        }
      />
      <form onSubmit={save} className="space-y-3 p-5">
        <Field label="Club / organizer name">{(p) => <Input {...p} value={form.name} onChange={set('name')} placeholder="e.g. Computing Society" />}</Field>
        <Field label="About" optional>{(p) => <Textarea {...p} rows={3} value={form.bio} onChange={set('bio')} placeholder="What does your club do? When do you meet?" />}</Field>
        <Field label="Logo URL" optional>{(p) => <Input {...p} type="url" value={form.logo} onChange={set('logo')} placeholder="https://…" />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Website" optional>{(p) => <Input {...p} type="url" value={form.website} onChange={set('website')} />}</Field>
          <Field label="Instagram" optional>{(p) => <Input {...p} type="url" value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/…" />}</Field>
        </div>
        <Button type="submit" loading={saving}>Save club page</Button>
      </form>
    </Card>
  )
}

function SiteSettings() {
  const { data: settings, loading } = useSubscription(subscribeSettings, [], { initial: DEFAULT_SETTINGS })
  const [form, setForm] = useState(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading) setForm(settings)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (group, key) => (e) => setForm((f) => ({ ...f, [group]: { ...f[group], [key]: e.target.value.trim() } }))

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await saveSettings({ socials: form.socials, cloudinary: form.cloudinary })
      toast.success('Settings saved')
    } catch {
      toast.error('Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="lg:row-span-2">
      <CardHeader title="Site settings" description="Visible to everyone on the public site." />
      <form onSubmit={save} className="space-y-6 p-5">
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-bold">Social links</legend>
          {['facebook', 'instagram', 'twitter'].map((k) => (
            <Field key={k} label={k === 'twitter' ? 'X / Twitter' : k[0].toUpperCase() + k.slice(1)} optional>
              {(p) => <Input {...p} type="url" value={form.socials[k]} onChange={set('socials', k)} placeholder={`https://${k === 'twitter' ? 'x' : k}.com/…`} />}
            </Field>
          ))}
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-bold">Cloudinary image uploads</legend>
          <p className="text-xs text-muted-foreground">Create an <b>unsigned</b> upload preset in Cloudinary → Settings → Upload, then paste its name here.</p>
          <Field label="Cloud name">{(p) => <Input {...p} value={form.cloudinary.cloudName} onChange={set('cloudinary', 'cloudName')} />}</Field>
          <Field label="Upload preset">{(p) => <Input {...p} value={form.cloudinary.uploadPreset} onChange={set('cloudinary', 'uploadPreset')} />}</Field>
        </fieldset>
        <Button type="submit" loading={saving}>Save settings</Button>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const [v, setV] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (v.next.length < 8) return setError('Use at least 8 characters.')
    if (v.next !== v.confirm) return setError('New passwords don’t match.')
    setBusy(true)
    try {
      await changePassword(v.current, v.next)
      setV({ current: '', next: '', confirm: '' })
      toast.success('Password changed')
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' ? 'Current password is wrong.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Change password" />
      <form onSubmit={submit} className="space-y-3 p-5">
        <Field label="Current password">{(p) => <Input {...p} type="password" autoComplete="current-password" value={v.current} onChange={set('current')} />}</Field>
        <Field label="New password">{(p) => <Input {...p} type="password" autoComplete="new-password" value={v.next} onChange={set('next')} />}</Field>
        <Field label="Confirm new password">{(p) => <Input {...p} type="password" autoComplete="new-password" value={v.confirm} onChange={set('confirm')} />}</Field>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" loading={busy}>Update password</Button>
      </form>
    </Card>
  )
}

function IntegrationStatus() {
  const env = import.meta.env
  const items = [
    ['Email notifications (EmailJS)', emailEnabled],
    ['Unsplash image search', Boolean(env.VITE_UNSPLASH_ACCESS_KEY)],
    ['AI descriptions (Gemini)', Boolean(env.VITE_GEMINI_API_KEY)],
  ]
  return (
    <Card>
      <CardHeader title="Integrations" description="Configured in the .env file when the site is built." />
      <ul className="divide-y">
        {items.map(([label, on]) => (
          <li key={label} className="flex items-center justify-between px-5 py-3 text-sm">
            {label}
            {on ? (
              <span className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="size-4" /> On</span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground"><CircleDashed className="size-4" /> Not set up</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
