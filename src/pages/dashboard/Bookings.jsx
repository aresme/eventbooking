import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download, ExternalLink, Search, Ticket, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { staffCancelBooking } from '@/services/bookings'
import { downloadCsv, formatPrice, toDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { Badge, Card, EmptyState, Skeleton } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'
import { useDashboard } from './DashboardLayout'

const PAGE = 50

export default function Bookings() {
  const { user } = useAuth()
  const { bookings, events, eventsById, loading } = useDashboard()
  const confirm = useConfirm()
  const [eventId, setEventId] = useState('all')
  const [status, setStatus] = useState('confirmed')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return bookings.filter(
      (b) =>
        (eventId === 'all' || b.eventId === eventId) &&
        (status === 'all' || b.status === status) &&
        (!term || [b.fullName, b.phone, b.email, b.regNumber, ...b.ticketCodes].some((f) => f?.toLowerCase().includes(term))),
    )
  }, [bookings, eventId, status, q])

  const totals = useMemo(() => {
    const ok = list.filter((b) => b.status === 'confirmed')
    return {
      tickets: ok.reduce((s, b) => s + b.quantity, 0),
      checkedIn: ok.reduce((s, b) => s + b.tickets.filter((t) => t.checkedIn).length, 0),
      value: ok.reduce((s, b) => s + b.unitPrice * b.quantity, 0),
    }
  }, [list])

  function exportCsv() {
    const rows = [['Ticket code', 'Event', 'Ticket type', 'Name', 'Phone', 'Email', 'Reg. no.', 'School', 'Price', 'Status', 'Checked in', 'Booked at', 'Source']]
    list.forEach((b) =>
      b.tickets.forEach((t) =>
        rows.push([
          t.code,
          eventsById[b.eventId]?.title || b.eventTitle,
          b.tierName,
          b.fullName,
          b.phone,
          b.email,
          b.regNumber,
          b.school,
          b.unitPrice,
          b.status,
          t.checkedIn ? 'yes' : 'no',
          toDate(b.bookedAt)?.toLocaleString('en-KE') || '',
          b.source,
        ]),
      ),
    )
    const name = eventId === 'all' ? 'all-events' : (eventsById[eventId]?.title || 'event').replace(/[^\w]+/g, '-')
    downloadCsv(`bookings-${name}-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  async function cancel(b) {
    const ok = await confirm({
      title: `Cancel ${b.fullName}’s booking?`,
      description: `${b.quantity} ticket${b.quantity > 1 ? 's' : ''} will be released back on sale.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep',
      danger: true,
    })
    if (!ok) return
    try {
      await staffCancelBooking(b, user)
      toast.success('Booking cancelled')
    } catch (err) {
      toast.error(err.message || 'Could not cancel')
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px_160px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email, reg. no. or ticket code" className="pl-9" aria-label="Search bookings" />
        </div>
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
          <option value="all">All events</option>
          {[...events].sort((a, b) => b.date.localeCompare(a.date)).map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All statuses</option>
        </Select>
        <Button variant="outline" onClick={exportCsv} disabled={!list.length}>
          <Download /> CSV
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{totals.tickets}</span> tickets · <span className="font-semibold text-foreground">{totals.checkedIn}</span> checked in · {formatPrice(totals.value)}
      </p>

      {loading ? (
        <Skeleton className="h-96" />
      ) : list.length === 0 ? (
        <EmptyState icon={Ticket} title="No bookings found" description="Try a different filter or search." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Attendee</th>
                  <th className="hidden px-4 py-3 md:table-cell">Event</th>
                  <th className="px-4 py-3">Tickets</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Booked</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.slice(0, limit).map((b) => {
                  const checked = b.tickets.filter((t) => t.checkedIn).length
                  return (
                    <tr key={b.id} className="align-top hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{b.fullName}</p>
                        <p className="text-xs text-muted-foreground">{b.phone}{b.email && ` · ${b.email}`}</p>
                        {b.regNumber && <p className="text-xs text-muted-foreground">{b.regNumber}</p>}
                        <p className="mt-1 text-xs text-muted-foreground md:hidden">{eventsById[b.eventId]?.title || b.eventTitle}</p>
                      </td>
                      <td className="hidden max-w-56 px-4 py-3 md:table-cell">
                        <p className="truncate font-medium">{eventsById[b.eventId]?.title || b.eventTitle}</p>
                        <p className="text-xs text-muted-foreground">{b.tierName} · {formatPrice(b.unitPrice)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs">{b.ticketCodes.join(', ')}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {b.status === 'cancelled' ? (
                            <Badge variant="danger">Cancelled</Badge>
                          ) : checked > 0 ? (
                            <Badge variant="success">{checked}/{b.quantity} in</Badge>
                          ) : (
                            <Badge variant="outline">×{b.quantity}</Badge>
                          )}
                          {b.source === 'waitlist' && <Badge variant="warning">Waitlist</Badge>}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs whitespace-nowrap text-muted-foreground sm:table-cell">
                        {toDate(b.bookedAt)?.toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button href={`/tickets/${b.id}`} target="_blank" variant="ghost" size="icon-sm" aria-label="Open ticket">
                            <ExternalLink />
                          </Button>
                          {b.status === 'confirmed' && (
                            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-danger" onClick={() => cancel(b)} aria-label="Cancel booking">
                              <XCircle />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {limit < list.length && (
            <div className="border-t p-3 text-center">
              <Button variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>Show more ({list.length - limit} left)</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
