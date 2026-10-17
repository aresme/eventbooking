import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Mail, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { DEFAULT_SETTINGS, subscribeSettings } from '@/services/settings'
import { sendMessage } from '@/services/messages'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { WhatsAppIcon } from '@/components/social-icons'

const TOPICS = [
  { value: 'booking', label: 'A booking or ticket' },
  { value: 'organizer', label: 'Hosting events' },
  { value: 'bug', label: 'Something isn’t working' },
  { value: 'other', label: 'Something else' },
]

export default function Contact() {
  const { user } = useAuth()
  const { data: settings } = useSubscription(subscribeSettings, [], { initial: DEFAULT_SETTINGS })
  const [form, setForm] = useState({ name: '', contact: '', topic: 'booking', message: '' })
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  useEffect(() => {
    document.title = 'Contact · UniVibe'
    return () => {
      document.title = 'UniVibe · Campus Events'
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    const er = {}
    if (form.name.trim().length < 2) er.name = 'Enter your name'
    if (form.contact.trim().length < 5) er.contact = 'Add an email or phone number so we can reply'
    if (form.message.trim().length < 5) er.message = 'Tell us a bit more'
    setErrors(er)
    if (Object.keys(er).length || !user) return
    setSending(true)
    try {
      await sendMessage(form, user.uid)
      setSent(true)
    } catch {
      toast.error('Couldn’t send your message. Try again.')
    } finally {
      setSending(false)
    }
  }

  const wa = settings.contactWhatsapp?.replace(/\D/g, '').replace(/^0/, '254')

  return (
    <div className="container-page grid max-w-5xl gap-10 py-12 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Contact us</h1>
        <p className="mt-2 text-muted-foreground">Questions about a booking, hosting an event or anything else. We usually reply within a day.</p>

        {sent ? (
          <div className="animate-fade-up mt-8 rounded-2xl border bg-card p-8 text-center shadow-card">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <h2 className="mt-3 text-xl font-bold">Message sent</h2>
            <p className="mt-1 text-muted-foreground">Thanks, {form.name.split(' ')[0]}. We’ll reply to {form.contact}.</p>
            <Button variant="outline" className="mt-6" to="/">Back to events</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-8 space-y-4 rounded-2xl border bg-card p-6 shadow-card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name" error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={set('name')} autoComplete="name" />}</Field>
              <Field label="Email or phone" error={errors.contact}>{(p) => <Input {...p} value={form.contact} onChange={set('contact')} autoComplete="email" />}</Field>
            </div>
            <Field label="What’s it about?">
              {(p) => (
                <Select {...p} value={form.topic} onChange={set('topic')}>
                  {TOPICS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Message" error={errors.message} hint={form.topic === 'booking' ? 'Include the event name and your ticket code if you have it.' : undefined}>
              {(p) => <Textarea {...p} rows={6} value={form.message} onChange={(e) => set('message')({ target: { value: e.target.value.slice(0, 2000) } })} />}
            </Field>
            <Button type="submit" loading={sending}>
              {!sending && <Send />} Send message
            </Button>
          </form>
        )}
      </div>

      {(settings.contactEmail || wa) && (
        <aside className="space-y-3 lg:pt-24">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Reach us directly</h2>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-input">
              <WhatsAppIcon className="size-5 text-[#25D366]" />
              <span><span className="block font-semibold">WhatsApp</span><span className="text-sm text-muted-foreground">{settings.contactWhatsapp}</span></span>
            </a>
          )}
          {settings.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-input">
              <Mail className="size-5 text-primary" />
              <span><span className="block font-semibold">Email</span><span className="text-sm text-muted-foreground">{settings.contactEmail}</span></span>
            </a>
          )}
        </aside>
      )}
    </div>
  )
}
