import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, PartyPopper, TicketX } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { cancelOwnBooking, subscribeBooking } from '@/services/bookings'
import { subscribeEvent } from '@/services/events'
import { isEnded } from '@/lib/utils'
import { TicketCard } from '@/components/TicketCard'
import { EventUpdates } from '@/components/EventUpdates'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'

export default function Ticket() {
  const { bookingId } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const confirm = useConfirm()
  const [cancelling, setCancelling] = useState(false)

  const { data: booking, loading } = useSubscription((ok, err) => subscribeBooking(bookingId, ok, err), [bookingId])
  // Events that are hidden/unpublished can't be read publicly; fall back to what the booking stored.
  const { data: event } = useSubscription((ok, err) => subscribeEvent(booking.eventId, ok, err), [booking?.eventId], {
    enabled: Boolean(booking?.eventId),
  })

  if (loading) {
    return (
      <div className="container-page max-w-md space-y-4 py-10">
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      </div>
    )
  }
  if (!booking) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={TicketX} title="Ticket not found" description="Check the link, or find your tickets under My tickets." action={<Button to="/my-tickets">My tickets</Button>} />
      </div>
    )
  }

  const ev = event || { id: booking.eventId, title: booking.eventTitle, date: '', time: '', venue: '' }
  const canCancel = user?.uid === booking.userId && booking.status === 'confirmed' && event && !isEnded(event) && !booking.tickets.some((t) => t.checkedIn)

  async function cancel() {
    const ok = await confirm({
      title: 'Cancel this booking?',
      description: `All ${booking.quantity} ticket${booking.quantity > 1 ? 's' : ''} in this booking will be released. This can’t be undone.`,
      confirmLabel: 'Cancel booking',
      cancelLabel: 'Keep it',
      danger: true,
    })
    if (!ok) return
    setCancelling(true)
    try {
      await cancelOwnBooking(booking, user.uid)
      toast.success('Booking cancelled')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Could not cancel')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="container-page max-w-md py-8">
      <Button to="/my-tickets" variant="ghost" size="sm" className="mb-4">
        <ArrowLeft /> My tickets
      </Button>

      {params.get('new') && booking.status === 'confirmed' && (
        <div className="animate-fade-up mb-5 flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-sm">
          <PartyPopper className="size-5 shrink-0 text-success" />
          <p>
            <span className="font-bold">Booking confirmed!</span> Your ticket is saved on this device under My tickets. Save an image too, just in case.
          </p>
        </div>
      )}

      <EventUpdates eventId={booking.eventId} className="mb-5" />
      <TicketCard booking={booking} event={ev} />

      {canCancel && (
        <Button variant="ghost" className="mt-6 w-full text-danger hover:bg-danger-soft" onClick={cancel} loading={cancelling}>
          Cancel booking
        </Button>
      )}
    </div>
  )
}
