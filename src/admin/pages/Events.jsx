import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { QRCodeCanvas } from 'qrcode.react'
import { CalendarDays, Check, Copy, Download, Eye, EyeOff, MoreHorizontal, Pencil, PlusCircle, QrCode, Search, Star, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { deleteEvent, setEventFeatured, setEventStatus } from '@/services/events'
import { cn, eventStats, formatDate, formatPrice, isEnded } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { Badge, Card, EmptyState, Progress, Segmented, Skeleton } from '@/components/ui/misc'
import { Dialog, useConfirm } from '@/components/ui/dialog'
import { useDashboard } from './DashboardLayout'
import { EventImage } from '@/components/EventImage'

const STATUS = {
  published: { label: 'Live', variant: 'success' },
  pending: { label: 'Awaiting approval', variant: 'warning' },
  hidden: { label: 'Hidden', variant: 'default' },
}

export default function Events() {
  const { user, isAdmin } = useAuth()
  const { events, bookings, loading } = useDashboard()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [qrEvent, setQrEvent] = useState(null)
  const confirm = useConfirm()
  const tab = params.get('status') || 'upcoming'

  const counts = useMemo(
    () => ({
      upcoming: events.filter((e) => !isEnded(e)).length,
      pending: events.filter((e) => e.status === 'pending').length,
      past: events.filter(isEnded).length,
    }),
    [events],
  )

  const list = useMemo(() => {
    let l = events
    if (tab === 'upcoming') l = l.filter((e) => !isEnded(e))
    if (tab === 'pending') l = l.filter((e) => e.status === 'pending')
    if (tab === 'past') l = l.filter(isEnded)
    const term = q.trim().toLowerCase()
    if (term) l = l.filter((e) => [e.title, e.venue, e.ownerName].some((f) => f?.toLowerCase().includes(term)))
    return [...l].sort((a, b) => (tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
  }, [events, tab, q])

  async function run(fn, success) {
    try {
      await fn()
      if (success) toast.success(success)
    } catch (err) {
      console.error(err)
      toast.error(err.code === 'permission-denied' ? 'You don’t have permission to do that.' : 'Something went wrong.')
    }
  }

  async function remove(event) {
    const count = bookings.filter((b) => b.eventId === event.id && b.status === 'confirmed').length
    const ok = await confirm({
      title: `Delete “${event.title}”?`,
      description: count
        ? `This event has ${count} active booking${count > 1 ? 's' : ''}. Their tickets will stop working. Consider hiding it instead.`
        : 'This can’t be undone.',
      confirmLabel: 'Delete event',
      danger: true,
    })
    if (ok) run(() => deleteEvent(event, user), 'Event deleted')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={tab}
          onChange={(v) => setParams(v === 'upcoming' ? {} : { status: v })}
          options={[
            { value: 'upcoming', label: `Upcoming (${counts.upcoming})` },
            { value: 'pending', label: `Pending (${counts.pending})` },
            { value: 'past', label: `Past (${counts.past})` },
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" aria-label="Search events" />
          </div>
          <Button to="/admin/events/new">
            <PlusCircle /> <span className="hidden sm:inline">New event</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No events here" description={tab === 'pending' ? 'Nothing waiting for approval.' : 'Create an event to get started.'} />
      ) : (
        <div className="space-y-3">
          {list.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              isAdmin={isAdmin}
              onStatus={(s) => run(() => setEventStatus(e, s, user), s === 'published' ? 'Event is live' : s === 'hidden' ? 'Event hidden' : 'Submitted for approval')}
              onFeature={() => run(() => setEventFeatured(e, !e.featured), e.featured ? 'Removed from featured' : 'Featured on home page')}
              onDelete={() => remove(e)}
              onQr={() => setQrEvent(e)}
            />
          ))}
        </div>
      )}

      <PromoQrDialog event={qrEvent} onClose={() => setQrEvent(null)} />
    </div>
  )
}

function EventRow({ event, isAdmin, onStatus, onFeature, onDelete, onQr }) {
  const [menu, setMenu] = useState(false)
  const s = eventStats(event)
  const status = STATUS[event.status] || STATUS.hidden
  const ended = isEnded(event)

  return (
    <Card className="flex items-center gap-4 p-3 sm:p-4">
      <EventImage event={event} w={200} h={140} className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button to={`/admin/events/${event.id}/edit`} variant="link" className="truncate font-bold text-foreground">
            {event.title}
          </Button>
          {event.featured && <Star className="size-4 fill-accent text-accent" aria-label="Featured" />}
          <Badge variant={ended ? 'outline' : status.variant}>{ended ? 'Ended' : status.label}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDate(event.date)} · {event.venue} · from {formatPrice(s.minPrice)}
          {isAdmin && event.ownerName && <> · by {event.ownerName}</>}
        </p>
        <div className="mt-2 flex max-w-xs items-center gap-2">
          <Progress value={s.pct} />
          <span className="shrink-0 text-xs font-semibold tabular-nums">{s.booked}/{s.total}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isAdmin && event.status === 'pending' && (
          <Button size="sm" onClick={() => onStatus('published')}>
            <Check /> Approve
          </Button>
        )}
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setMenu((m) => !m)} aria-label="Event actions" aria-expanded={menu}>
            <MoreHorizontal />
          </Button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="animate-fade-up absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border bg-card p-1 shadow-xl" onClick={() => setMenu(false)}>
                <MenuItem icon={Pencil} to={`/admin/events/${event.id}/edit`}>Edit</MenuItem>
                {event.status === 'published' && <MenuItem icon={Eye} href={`/events/${event.id}`}>View public page</MenuItem>}
                <MenuItem icon={QrCode} onClick={onQr}>Promo QR code</MenuItem>
                {isAdmin && <MenuItem icon={Star} onClick={onFeature}>{event.featured ? 'Unfeature' : 'Feature on home'}</MenuItem>}
                {event.status === 'published' && <MenuItem icon={EyeOff} onClick={() => onStatus('hidden')}>Hide from public</MenuItem>}
                {event.status === 'hidden' && (isAdmin
                  ? <MenuItem icon={Eye} onClick={() => onStatus('published')}>Publish</MenuItem>
                  : <MenuItem icon={Eye} onClick={() => onStatus('pending')}>Submit for approval</MenuItem>)}
                <MenuItem icon={Trash2} onClick={onDelete} danger>Delete</MenuItem>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function MenuItem({ icon: Icon, children, danger, to, href, onClick }) {
  const cls = cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted [&_svg]:size-4', danger && 'text-danger hover:bg-danger-soft')
  const content = <><Icon /> {children}</>
  if (to) return <Button to={to} variant="ghost" className={cn(cls, 'h-auto justify-start')}>{content}</Button>
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{content}</a>
  return <button onClick={onClick} className={cls}>{content}</button>
}

function PromoQrDialog({ event, onClose }) {
  const url = event ? `${window.location.origin}/events/${event.id}` : ''

  function download() {
    const canvas = document.getElementById('promo-qr')
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${event.title.replace(/[^\w]+/g, '-')}-QR.png`
    a.click()
  }

  return (
    <Dialog open={Boolean(event)} onClose={onClose} title="Promo QR code" description="Print it on posters. Scanning opens the event page." size="sm">
      {event && (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl bg-white p-4 ring-1 ring-border">
            <QRCodeCanvas id="promo-qr" value={url} size={220} level="M" marginSize={1} />
          </div>
          <p className="w-full truncate rounded-lg bg-muted px-3 py-2 text-center font-mono text-xs">{url}</p>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))}>
              <Copy /> Copy link
            </Button>
            <Button onClick={download}>
              <Download /> Download
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
