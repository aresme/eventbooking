import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertCircle, CalendarDays, Hourglass, PlusCircle, Ticket, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { eventStats, formatDate, formatPrice, isEnded, timeAgo, toDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, Progress, Skeleton } from '@/components/ui/misc'
import { useDashboard } from './DashboardLayout'

export default function Overview() {
  const { user, isAdmin } = useAuth()
  const { events, bookings, waitlist, eventsById, loading } = useDashboard()

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => b.status === 'confirmed')
    const tickets = confirmed.reduce((s, b) => s + b.quantity, 0)
    const revenue = confirmed.reduce((s, b) => s + (b.unitPrice || 0) * b.quantity - (b.discount || 0), 0)
    const today = new Date().toDateString()
    const todayCount = confirmed.filter((b) => toDate(b.bookedAt)?.toDateString() === today).reduce((s, b) => s + b.quantity, 0)
    const checkedIn = confirmed.reduce((s, b) => s + b.tickets.filter((t) => t.checkedIn).length, 0)
    return { tickets, revenue, todayCount, checkedIn, upcoming: events.filter((e) => !isEnded(e)).length }
  }, [bookings, events])

  // Tickets booked per day for the last 14 days.
  const chart = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - (13 - i))
      return { key: d.toDateString(), label: d.toLocaleDateString('en', { day: 'numeric', month: 'short' }), tickets: 0 }
    })
    const index = Object.fromEntries(days.map((d, i) => [d.key, i]))
    bookings.forEach((b) => {
      if (b.status !== 'confirmed') return
      const i = index[toDate(b.bookedAt)?.toDateString()]
      if (i !== undefined) days[i].tickets += b.quantity
    })
    return days
  }, [bookings])

  const pending = events.filter((e) => e.status === 'pending')
  const upcoming = events.filter((e) => !isEnded(e)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={`Welcome, ${user.profile?.displayName || 'organizer'}!`}
        description="Create your first event and start taking bookings."
        action={<Button to="/events/new"><PlusCircle /> Create event</Button>}
      />
    )
  }

  return (
    <div className="space-y-6">
      {isAdmin && pending.length > 0 && (
        <Link to="/events?status=pending" className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
          <AlertCircle className="size-5 shrink-0 text-warning" />
          <span>
            <span className="font-bold">{pending.length} event{pending.length > 1 ? 's' : ''} waiting for approval.</span> Review them before they go public.
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={CalendarDays} label="Upcoming events" value={stats.upcoming} />
        <StatCard icon={Ticket} label="Tickets sold" value={stats.tickets} sub={`${stats.todayCount} today · ${stats.checkedIn} checked in`} />
        <StatCard icon={Wallet} label="Ticket value" value={formatPrice(stats.revenue)} />
        <StatCard icon={Hourglass} label="On waitlist" value={waitlist.length} />
      </div>

      <Card>
        <CardHeader title="Bookings, last 14 days" />
        <div className="h-64 p-4 pl-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ fontWeight: 700, color: 'var(--foreground)' }}
              />
              <Area type="monotone" dataKey="tickets" name="Tickets" stroke="var(--primary)" strokeWidth={2} fill="url(#fill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming events" action={<Button to="/events" variant="ghost" size="sm">View all</Button>} />
          <ul className="divide-y">
            {upcoming.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No upcoming events</li>}
            {upcoming.map((e) => {
              const s = eventStats(e)
              return (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link to={`/events/${e.id}/edit`} className="truncate text-sm font-semibold hover:text-primary">{e.title}</Link>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(e.date, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={s.pct} />
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{s.booked}/{s.total}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Recent bookings" action={<Button to="/bookings" variant="ghost" size="sm">View all</Button>} />
          <ul className="divide-y">
            {bookings.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No bookings yet</li>}
            {bookings.slice(0, 6).map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold uppercase">{b.fullName[0]}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{b.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{eventsById[b.eventId]?.title || b.eventTitle} · {b.tierName} × {b.quantity}</p>
                </div>
                {b.status === 'cancelled' ? <Badge variant="danger">Cancelled</Badge> : <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(b.bookedAt)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}
