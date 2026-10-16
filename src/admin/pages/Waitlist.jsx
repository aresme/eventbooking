import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowUpCircle, Hourglass, Mail, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { promoteFromWaitlist } from '@/services/bookings'
import { removeWaitlistEntry } from '@/services/waitlist'
import { emailEnabled, sendWaitlistPromotion } from '@/services/email'
import { timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/form'
import { Badge, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'
import { useDashboard } from './DashboardLayout'

export default function Waitlist() {
  const { user } = useAuth()
  const { waitlist, events, eventsById, loading } = useDashboard()
  const confirm = useConfirm()
  const [eventId, setEventId] = useState('all')
  const [busy, setBusy] = useState(null)

  // Group by event + tier, oldest first, with free seats for each group.
  const groups = useMemo(() => {
    const map = new Map()
    waitlist
      .filter((w) => eventId === 'all' || w.eventId === eventId)
      .forEach((w) => {
        const key = `${w.eventId}_${w.tierId}`
        if (!map.has(key)) {
          const tier = eventsById[w.eventId]?.tiers?.[w.tierId]
          map.set(key, { key, event: eventsById[w.eventId], eventTitle: w.eventTitle, tier, tierName: tier?.name || w.tierName, entries: [] })
        }
        map.get(key).entries.push(w)
      })
    return [...map.values()]
  }, [waitlist, eventsById, eventId])

  async function promote(entry, event) {
    const ok = await confirm({
      title: `Give ${entry.fullName} a seat?`,
      description: `They get a confirmed ${entry.tierName} ticket for ${entry.eventTitle}.${entry.email && emailEnabled ? ' We’ll email them their ticket.' : ' Let them know by phone: ' + entry.phone}`,
      confirmLabel: 'Promote',
    })
    if (!ok) return
    setBusy(entry.id)
    try {
      const bookingId = await promoteFromWaitlist(entry, user)
      const sent = event && (await sendWaitlistPromotion({ bookingId, entry, event }))
      toast.success(`${entry.fullName} now has a ticket${sent ? ' and was emailed' : ''}`)
    } catch (err) {
      toast.error(err.message || 'Could not promote')
    } finally {
      setBusy(null)
    }
  }

  async function remove(entry) {
    const ok = await confirm({ title: `Remove ${entry.fullName} from the waitlist?`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    try {
      await removeWaitlistEntry(entry, user)
      toast.success('Removed from waitlist')
    } catch {
      toast.error('Could not remove')
    }
  }

  const withWaitlist = events.filter((e) => waitlist.some((w) => w.eventId === e.id))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">When a seat frees up, promote the person who’s waited longest.</p>
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} className="sm:w-64" aria-label="Event">
          <option value="all">All events</option>
          {withWaitlist.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : groups.length === 0 ? (
        <EmptyState icon={Hourglass} title="Nobody is waiting" description="People can join a waitlist when a ticket type sells out." />
      ) : (
        groups.map((g) => {
          const free = g.tier ? g.tier.totalSlots - g.tier.bookedSlots : 0
          return (
            <Card key={g.key}>
              <CardHeader
                title={g.event?.title || g.eventTitle}
                description={`${g.tierName} · ${g.entries.length} waiting`}
                action={<Badge variant={free > 0 ? 'success' : 'outline'}>{free > 0 ? `${free} seat${free > 1 ? 's' : ''} free` : 'Full'}</Badge>}
              />
              <ol className="divide-y">
                {g.entries.map((w, i) => (
                  <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{w.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {w.phone}
                        {w.email && <> · <Mail className="inline size-3" /> {w.email}</>} · {timeAgo(w.joinedAt)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => promote(w, g.event)} disabled={free <= 0} loading={busy === w.id} title={free <= 0 ? 'No free seats' : undefined}>
                      {busy !== w.id && <ArrowUpCircle />} Promote
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-danger" onClick={() => remove(w)} aria-label="Remove">
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ol>
            </Card>
          )
        })
      )}
    </div>
  )
}
