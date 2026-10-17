import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { ChevronRight, CloudUpload, Hourglass, Ticket } from 'lucide-react'
import { signInWithGoogle, useAuth } from '@/hooks/useAuth'
import { deviceBookingIds } from '@/lib/deviceTickets'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeBooking, subscribeMyBookings } from '@/services/bookings'
import { subscribeMyWaitlist } from '@/services/waitlist'
import { subscribeEvent } from '@/services/events'
import { usePeople } from '@/hooks/usePeople'
import { EventCard } from '@/components/EventCard'
import { formatPrice, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Skeleton } from '@/components/ui/misc'

export default function MyTickets() {
  const { user, loading: authLoading } = useAuth()
  const uid = user?.uid
  const { data: bookings = [], loading } = useSubscription((ok, err) => subscribeMyBookings(uid, ok, err), [uid], { enabled: Boolean(uid), initial: [] })
  const { data: waitlist = [] } = useSubscription((ok, err) => subscribeMyWaitlist(uid, ok, err), [uid], { enabled: Boolean(uid), initial: [] })

  const deviceBookings = useDeviceBookings(bookings)

  const [active, past] = useMemo(() => {
    const all = [...bookings, ...deviceBookings.filter((d) => !bookings.some((b) => b.id === d.id))]
    all.sort((a, b) => (b.bookedAt?.seconds || 0) - (a.bookedAt?.seconds || 0))
    return [all.filter((b) => b.status === 'confirmed'), all.filter((b) => b.status !== 'confirmed')]
  }, [bookings, deviceBookings])
  const total = active.length + past.length

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">My tickets</h1>
      <p className="mt-1 text-muted-foreground">
        {user?.isGoogle ? `Tickets saved to ${user.email}, plus any booked on this device.` : 'Tickets booked on this device. Each ticket also has its own link you can open anywhere.'}
      </p>

      {user && !user.isGoogle && <SaveToGoogle hasTickets={total > 0} />}

      <div className="mt-8 space-y-3">
        {authLoading || loading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : total === 0 && waitlist.length === 0 ? (
          <>
            <EmptyState icon={Ticket} title="No tickets yet" description="When you book an event, your ticket shows up here." action={<Button to="/">Browse events</Button>} />
            <SavedEvents />
          </>
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
            <SavedEvents />
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

function SavedEvents() {
  const { saved } = usePeople()
  const [events, setEvents] = useState({})
  const key = saved.join(',')
  useEffect(() => {
    if (!key) return
    const unsubs = key.split(',').map((id) => subscribeEvent(id, (e) => setEvents((m) => ({ ...m, [id]: e })), () => setEvents((m) => ({ ...m, [id]: null }))))
    return () => unsubs.forEach((u) => u())
  }, [key])
  const list = saved.map((id) => events[id]).filter(Boolean)
  if (list.length === 0) return null
  return (
    <>
      <h2 className="pt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">Saved events</h2>
      <div className="grid gap-4 sm:grid-cols-2">{list.map((e) => <EventCard key={e.id} event={e} />)}</div>
    </>
  )
}

/** Bookings remembered on this device that the account query didn't return (e.g. after switching accounts). */
function useDeviceBookings(accountBookings) {
  const [items, setItems] = useState({})
  const missing = deviceBookingIds().filter((id) => !accountBookings.some((b) => b.id === id))
  const key = missing.join(',')
  useEffect(() => {
    if (!key) return
    const unsubs = key.split(',').map((id) => subscribeBooking(id, (b) => setItems((m) => ({ ...m, [id]: b })), () => {}))
    return () => unsubs.forEach((u) => u())
  }, [key])
  return missing.map((id) => items[id]).filter(Boolean)
}

function SaveToGoogle({ hasTickets }) {
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await signInWithGoogle()
      toast.success('Signed in. Your tickets are saved to your Google account.')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error(err)
        toast.error('Google sign-in failed. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card sm:flex-row sm:items-center">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
        <CloudUpload className="size-5" />
      </div>
      <div className="flex-1">
        <p className="font-bold">{hasTickets ? 'Keep your tickets safe' : 'Booked on another device?'}</p>
        <p className="text-sm text-muted-foreground">
          {hasTickets ? 'Sign in with Google to see these tickets on any phone or laptop, even if you clear your browser.' : 'Sign in with Google to see tickets you saved to your account.'}
        </p>
      </div>
      <Button variant="outline" onClick={save} loading={busy}>
        {!busy && <GoogleIcon />} Continue with Google
      </Button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2.1a11 11 0 0 0 0 9.8L5.8 14Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1L5.8 10c.9-2.7 3.3-4.6 6.2-4.6Z" />
    </svg>
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
          {booking.tierName} × {booking.quantity} · {formatPrice(booking.unitPrice * booking.quantity - (booking.discount || 0))}
        </p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{booking.ticketCodes.join(' · ')}</p>
      </div>
      {cancelled ? <Badge variant="danger">Cancelled</Badge> : checked > 0 ? <Badge variant="success">Checked in</Badge> : null}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
