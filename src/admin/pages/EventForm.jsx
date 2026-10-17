import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, HelpCircle, ImageUp, ListOrdered, X, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { saveEvent } from '@/services/events'
import { DEFAULT_SETTINGS, generateDescription, searchUnsplash, subscribeSettings, uploadToCloudinary } from '@/services/settings'
import { CATEGORIES, cn, SCHOOLS, shortId, tierList } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form'
import { Card, CardHeader, EmptyState } from '@/components/ui/misc'
import { useDashboard } from './DashboardLayout'

const EMPTY = {
  title: '',
  description: '',
  type: 'normal',
  category: '',
  school: '',
  date: '',
  time: '18:00',
  venue: '',
  mapQuery: '',
  image: '',
  allowMultiple: false,
  maxTickets: 5,
  schedule: [],
  faqs: [],
}

const newTier = (name = 'General', price = 0, totalSlots = 100) => ({ id: shortId(), name, price, totalSlots, bookedSlots: 0 })

export default function EventForm() {
  const { eventId } = useParams()
  const { user, isAdmin } = useAuth()
  const { eventsById, loading } = useDashboard()
  const navigate = useNavigate()
  const existing = eventId ? eventsById[eventId] : null
  const [params] = useSearchParams()
  const copyFrom = !eventId && params.get('from') ? eventsById[params.get('from')] : null

  const [values, setValues] = useState(EMPTY)
  const [tiers, setTiers] = useState([newTier()])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const loadedFor = useRef(null)

  // Load the event once (don't overwrite edits when live data updates).
  useEffect(() => {
    if (existing && loadedFor.current !== existing.id) {
      loadedFor.current = existing.id
      setValues({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, existing[k] ?? EMPTY[k]])) })
      setTiers(tierList(existing))
    }
  }, [existing])

  // "Duplicate": same details and ticket types, new date, nothing booked.
  useEffect(() => {
    if (copyFrom && loadedFor.current !== `copy-${copyFrom.id}`) {
      loadedFor.current = `copy-${copyFrom.id}`
      setValues({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, copyFrom[k] ?? EMPTY[k]])), title: `${copyFrom.title} (copy)`, date: '' })
      setTiers(tierList(copyFrom).map((t) => ({ ...t, id: shortId(), bookedSlots: 0 })))
      toast.info('Copied. Pick a new date, then publish.')
    }
  }, [copyFrom])

  if (eventId && !existing) {
    return loading ? null : <EmptyState title="Event not found" description="It may have been deleted, or it belongs to another organizer." action={<Button to="/admin/events">Back to events</Button>} />
  }

  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setValues((s) => ({ ...s, [k]: v }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  const updateTier = (id, k, v) => setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, [k]: v } : t)))

  function validate() {
    const er = {}
    if (values.title.trim().length < 3) er.title = 'Add a title'
    if (!values.date) er.date = 'Pick a date'
    else if (!existing && values.date < new Date().toISOString().slice(0, 10)) er.date = 'Date is in the past'
    if (!values.time) er.time = 'Pick a time'
    if (!values.venue.trim()) er.venue = 'Add a venue'
    if (values.type === 'school' && !values.school) er.school = 'Select a school'
    if (tiers.length === 0) er.tiers = 'Add at least one ticket type'
    tiers.forEach((t) => {
      if (!t.name.trim()) er.tiers = 'Every ticket type needs a name'
      if (Number(t.totalSlots) < (t.bookedSlots || 0)) er.tiers = `${t.name} already has ${t.bookedSlots} booked, so capacity can’t be lower.`
    })
    setErrors(er)
    return Object.keys(er).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    if (!validate()) {
      toast.error('Fix the highlighted fields')
      return
    }
    setSaving(true)
    try {
      await saveEvent({ id: existing?.id, values, tiers, existing, user })
      toast.success(existing ? 'Event saved' : isAdmin ? 'Event published' : 'Event submitted for approval')
      navigate('/admin/events')
    } catch (err) {
      console.error(err)
      toast.error(err.code === 'permission-denied' ? 'You don’t have permission to save this event.' : 'Could not save the event.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button to="/admin/events" variant="ghost" size="sm">
          <ArrowLeft /> Events
        </Button>
        <Button type="submit" loading={saving}>
          {existing ? 'Save changes' : isAdmin ? 'Publish event' : 'Submit for approval'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Event details" />
            <div className="space-y-4 p-5">
              <Field label="Title" error={errors.title}>
                {(p) => <Input {...p} value={values.title} onChange={set('title')} placeholder="e.g. Freshers’ Night 2026" />}
              </Field>
              <DescriptionField values={values} onChange={set('description')} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category">
                  {(p) => (
                    <Select {...p} value={values.category} onChange={set('category')}>
                      <option value="">Choose a category</option>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Who can attend">
                  {(p) => (
                    <Select {...p} value={values.type} onChange={set('type')}>
                      <option value="normal">Open to everyone</option>
                      <option value="school">School event (reg. no. required)</option>
                    </Select>
                  )}
                </Field>
                {values.type === 'school' && (
                  <Field label="School" error={errors.school} className="sm:col-span-2">
                    {(p) => (
                      <Select {...p} value={values.school} onChange={set('school')}>
                        <option value="">Select school</option>
                        {SCHOOLS.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Date & place" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Date" error={errors.date}>
                {(p) => <Input {...p} type="date" value={values.date} onChange={set('date')} min={existing ? undefined : new Date().toISOString().slice(0, 10)} />}
              </Field>
              <Field label="Start time" error={errors.time}>
                {(p) => <Input {...p} type="time" value={values.time} onChange={set('time')} />}
              </Field>
              <Field label="Venue" error={errors.venue}>
                {(p) => <Input {...p} value={values.venue} onChange={set('venue')} placeholder="e.g. Main Hall" />}
              </Field>
              <Field label="Map search" optional hint="What to search on Google Maps, if different from the venue.">
                {(p) => <Input {...p} value={values.mapQuery} onChange={set('mapQuery')} placeholder="e.g. JKUAT Main Hall, Juja" />}
              </Field>
            </div>
          </Card>

          <ScheduleFaqCard values={values} setValues={setValues} />

          <Card>
            <CardHeader
              title="Tickets"
              description="Add a type for each price level, e.g. Regular and VIP."
              action={
                <Button type="button" variant="soft" size="sm" onClick={() => setTiers((t) => [...t, newTier(t.length ? 'VIP' : 'General', 0, 50)])}>
                  <Plus /> Add type
                </Button>
              }
            />
            <div className="space-y-3 p-5">
              {tiers.map((t) => (
                <div key={t.id} className="grid grid-cols-2 items-start gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_130px_130px_auto]">
                  <Field label="Name" className="col-span-2 sm:col-span-1">
                    {(p) => <Input {...p} value={t.name} onChange={(e) => updateTier(t.id, 'name', e.target.value)} placeholder="e.g. Regular" />}
                  </Field>
                  <Field label="Price (KES)">
                    {(p) => <Input {...p} type="number" min="0" inputMode="numeric" value={t.price} onChange={(e) => updateTier(t.id, 'price', e.target.value)} />}
                  </Field>
                  <Field label="Capacity" hint={t.bookedSlots ? `${t.bookedSlots} booked` : undefined}>
                    {(p) => <Input {...p} type="number" min={Math.max(1, t.bookedSlots || 0)} inputMode="numeric" value={t.totalSlots} onChange={(e) => updateTier(t.id, 'totalSlots', e.target.value)} />}
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="col-span-2 justify-self-end text-muted-foreground hover:text-danger sm:col-span-1 sm:mt-7 sm:size-10 sm:p-0"
                    onClick={() => setTiers((ts) => ts.filter((x) => x.id !== t.id))}
                    disabled={tiers.length === 1 || t.bookedSlots > 0}
                    title={t.bookedSlots > 0 ? 'Has bookings, can’t remove' : 'Remove'}
                    aria-label={`Remove ${t.name}`}
                  >
                    <Trash2 /> <span className="sm:hidden">Remove</span>
                  </Button>
                </div>
              ))}
              {errors.tiers && <p className="text-sm font-medium text-danger">{errors.tiers}</p>}

              <div className="space-y-4 border-t pt-4">
                <Switch checked={values.allowMultiple} onChange={set('allowMultiple')} label="Allow more than one ticket per person" description="Otherwise each person can book one ticket." />
                {values.allowMultiple && (
                  <Field label="Max tickets per person" className="max-w-40">
                    {(p) => <Input {...p} type="number" min="1" max="20" value={values.maxTickets} onChange={set('maxTickets')} />}
                  </Field>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <CoverImage value={values.image} onChange={set('image')} title={values.title} />
        </div>
      </div>
    </form>
  )
}

const FAQ_SUGGESTIONS = [
  { q: 'Is there a dress code?', a: '' },
  { q: 'Can I get a refund?', a: '' },
  { q: 'Do I need my student ID?', a: '' },
  { q: 'Is there parking?', a: '' },
]

function ScheduleFaqCard({ values, setValues }) {
  const schedule = values.schedule || []
  const faqs = values.faqs || []
  const setList = (key, list) => setValues((v) => ({ ...v, [key]: list }))
  const update = (key, i, field, val) => setList(key, (values[key] || []).map((x, j) => (j === i ? { ...x, [field]: val } : x)))
  const remove = (key, i) => setList(key, (values[key] || []).filter((_, j) => j !== i))

  return (
    <Card>
      <CardHeader title="Schedule & FAQ" description="Optional. Shown on the event page; events with these details convert better." />
      <div className="space-y-6 p-5">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold"><ListOrdered className="size-4" /> Schedule</p>
          {schedule.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input type="time" value={item.time} onChange={(e) => update('schedule', i, 'time', e.target.value)} className="w-32 shrink-0" aria-label="Time" />
              <Input value={item.title} onChange={(e) => update('schedule', i, 'title', e.target.value)} placeholder="e.g. Doors open, Keynote, DJ set" aria-label="What happens" />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove('schedule', i)} aria-label="Remove item"><X /></Button>
            </div>
          ))}
          <Button type="button" variant="soft" size="sm" onClick={() => setList('schedule', [...schedule, { time: '', title: '' }])}>
            <Plus /> Add schedule item
          </Button>
        </div>

        <div className="space-y-2 border-t pt-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><HelpCircle className="size-4" /> Frequently asked questions</p>
          {faqs.map((f, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex gap-2">
                <Input value={f.q} onChange={(e) => update('faqs', i, 'q', e.target.value)} placeholder="Question" aria-label="Question" />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove('faqs', i)} aria-label="Remove question"><X /></Button>
              </div>
              <Textarea rows={2} value={f.a} onChange={(e) => update('faqs', i, 'a', e.target.value)} placeholder="Answer" aria-label="Answer" className="min-h-0" />
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" variant="soft" size="sm" onClick={() => setList('faqs', [...faqs, { q: '', a: '' }])}>
              <Plus /> Add question
            </Button>
            {FAQ_SUGGESTIONS.filter((x) => !faqs.some((f) => f.q === x.q)).map((x) => (
              <button key={x.q} type="button" onClick={() => setList('faqs', [...faqs, { ...x }])} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                + {x.q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function DescriptionField({ values, onChange }) {
  const [busy, setBusy] = useState(false)
  async function ai() {
    if (!values.title.trim()) {
      toast.error('Add a title first')
      return
    }
    setBusy(true)
    try {
      onChange(await generateDescription(values))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Field label="Description">
      {(p) => (
        <div className="space-y-2">
          <Textarea {...p} rows={6} value={values.description} onChange={onChange} placeholder="What should people know? Lineup, dress code, what to bring…" />
          {import.meta.env.VITE_GEMINI_API_KEY && (
            <Button type="button" variant="soft" size="sm" onClick={ai} loading={busy}>
              {!busy && <Sparkles />} Write with AI
            </Button>
          )}
        </div>
      )}
    </Field>
  )
}

function CoverImage({ value, onChange, title }) {
  const { data: settings } = useSubscription(subscribeSettings, [], { initial: DEFAULT_SETTINGS })
  const [uploading, setUploading] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const canUpload = settings.cloudinary.cloudName && settings.cloudinary.uploadPreset
  const canSearch = Boolean(import.meta.env.VITE_UNSPLASH_ACCESS_KEY)

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8 MB')
      return
    }
    setUploading(true)
    try {
      onChange(await uploadToCloudinary(file, settings.cloudinary))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function search(e) {
    e?.preventDefault()
    const term = q.trim() || title
    if (!term) return
    setSearching(true)
    try {
      setResults(await searchUnsplash(term))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader title="Cover image" />
      <div className="space-y-4 p-5">
        <div className="relative grid aspect-[16/10] place-items-center overflow-hidden rounded-xl border bg-muted">
          {value ? <img src={value} alt="Cover preview" className="size-full object-cover" /> : <ImageUp className="size-8 text-muted-foreground" />}
        </div>

        {canUpload && (
          <label className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-semibold hover:bg-muted', uploading && 'pointer-events-none opacity-60')}>
            <ImageUp className="size-4" /> {uploading ? 'Uploading…' : 'Upload image'}
            <input type="file" accept="image/*" className="sr-only" onChange={upload} />
          </label>
        )}

        {canSearch && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(e)} placeholder="Search Unsplash…" aria-label="Search Unsplash" />
              <Button type="button" variant="outline" size="icon" onClick={search} loading={searching} aria-label="Search">
                {!searching && <Search />}
              </Button>
            </div>
            {results.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5">
                {results.map((r) => (
                  <button key={r.id} type="button" onClick={() => onChange(r.full)} className={cn('overflow-hidden rounded-md ring-2 ring-transparent', value === r.full && 'ring-primary')} title={`Photo by ${r.author}`}>
                    <img src={r.thumb} alt={r.alt || ''} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Field label="Or paste an image URL" optional>
          {(p) => <Input {...p} value={value} onChange={onChange} placeholder="https://…" />}
        </Field>
        {!canUpload && !canSearch && <p className="text-xs text-muted-foreground">Tip: set up Cloudinary in Settings to upload images directly.</p>}
      </div>
    </Card>
  )
}
