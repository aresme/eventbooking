import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Hourglass, Ticket } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeMyBookings } from '@/services/bookings'
import { subscribeMyWaitlist } from '@/services/waitlist'
import { formatPrice, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Skeleton } from '@/components/ui/misc'

export default function MyTickets() {
  const { user, loading: authLoading } = useAuth()
  const uid = user?.uid
  const { data: bookings = [], loading } = useSubscription((ok, err) => subscribeMyBookings(uid, ok, err), [uid], { enabled: Boolean(uid), initial: [] })
  const { data: waitlist = [] } = useSubscription((ok, err) => subscribeMyWaitlist(uid, ok, err), [uid], { enabled: Boolean(uid), initial: [] })

  const [active, past] = useMemo(() => {
    const a = bookings.filter((b) => b.status === 'confirmed')
    const p = bookings.filter((b) => b.status !== 'confirmed')
    return [a, p]
  }, [bookings])

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">My tickets</h1>
      <p className="mt-1 text-muted-foreground">Tickets booked on this device. Each ticket also has its own link you can open anywhere.</p>

      <div className="mt-8 space-y-3">
        {authLoading || loading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : bookings.length === 0 && waitlist.length === 0 ? (
          <EmptyState icon={Ticket} title="No tickets yet" description="When you book an event, your ticket shows up here." action={<Button to="/">Browse events</Button>} />
        ) : (
          <>
            {active.map((b) => <BookingRow key={b.id} booking={b} />)}
            {waitlist.length > 0 && (
              <>
                <h2 className="pt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Waitlist</h2>
                {waitlist.map((w) => (
                  <Link key={w.id} to={`/events/${w.eventId}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-input">
                    <div className="grid size-12 place-items-center rounded-lg bg-warning-soft text-warning">
                      <Hourglass className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{w.eventTitle}</p>
                      <p className="text-sm text-muted-foreground">{w.tierName} · joined {timeAgo(w.joinedAt)}</p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Link>
                ))}
              </>
            )}
            {past.length > 0 && (
              <>
                <h2 className="pt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Cancelled</h2>
                {past.map((b) => <BookingRow key={b.id} booking={b} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function BookingRow({ booking }) {
  const cancelled = booking.status !== 'confirmed'
  const checked = booking.tickets.filter((t) => t.checkedIn).length
  return (
    <Link to={`/tickets/${booking.id}`} className={`flex items-center gap-4 rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-input ${cancelled ? 'opacity-60' : ''}`}>
      <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Ticket className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{booking.eventTitle}</p>
        <p className="text-sm text-muted-foreground">
          {booking.tierName} × {booking.quantity} · {formatPrice(booking.unitPrice * booking.quantity)}
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{booking.ticketCodes.join(' · ')}</p>
      </div>
      {cancelled ? <Badge variant="danger">Cancelled</Badge> : checked > 0 ? <Badge variant="success">Checked in</Badge> : null}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
