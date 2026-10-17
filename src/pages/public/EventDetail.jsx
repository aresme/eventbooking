import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, CalendarDays, Clock, GraduationCap, Hourglass, MapPin, Minus, Plus, Share2, Star, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeEvent } from '@/services/events'
import { BookingError, createBooking, subscribeBooking } from '@/services/bookings'
import { AlreadyWaitlistedError, joinWaitlist } from '@/services/waitlist'
import { sendBookingConfirmation } from '@/services/email'
import { checkPromo, PromoError } from '@/services/promos'
import { promoDiscount, promoLabel } from '@/lib/utils'
import { categoryOf, cn, eventStats, formatDate, formatPrice, formatTime, isEnded, tierList } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Progress, Skeleton } from '@/components/ui/misc'
import { Dialog } from '@/components/ui/dialog'
import { CalendarButton } from '@/components/TicketCard'
import { FollowButton, SaveButton } from '@/components/SaveFollow'
import { EventUpdates } from '@/components/EventUpdates'
import { AttendeeFields, cleanAttendee, useAttendeeForm, validateAttendee } from '@/components/AttendeeForm'
import { EventImage } from '@/components/EventImage'

export default function EventDetail() {
  const { eventId } = useParams()
  const { data: event, loading } = useSubscription((ok, err) => subscribeEvent(eventId, ok, err), [eventId])
  const [tierId, setTierId] = useState(null)
  const [qty, setQty] = useState(1)
  const [dialog, setDialog] = useState(null) // 'book' | 'waitlist'

  const tiers = useMemo(() => tierList(event), [event])
  const tier = tiers.find((t) => t.id === tierId)

  // Pre-select the first tier that still has seats.
  useEffect(() => {
    if (!tierId && tiers.length) setTierId((tiers.find((t) => t.bookedSlots < t.totalSlots) || tiers[0]).id)
  }, [tiers, tierId])

  useEffect(() => {
    if (event) document.title = `${event.title} · UniVibe`
    return () => {
      document.title = 'UniVibe · Campus Events'
    }
  }, [event])

  if (loading) return <DetailSkeleton />
  if (!event) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={CalendarDays} title="Event not found" description="It may have been removed or the link is wrong." action={<Button to="/">Browse events</Button>} />
      </div>
    )
  }

  const s = eventStats(event)
  const ended = isEnded(event)
  const tierLeft = tier ? tier.totalSlots - tier.bookedSlots : 0
  const tierSoldOut = tier && tierLeft <= 0
  const maxQty = Math.max(1, Math.min(event.allowMultiple ? event.maxTickets : 1, tierLeft || 1))

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: event.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
      }
    } catch {
      /* cancelled */
    }
  }

  const action = ended ? (
    <Button size="lg" className="w-full" disabled>
      This event has ended
    </Button>
  ) : tierSoldOut ? (
    <Button size="lg" variant="outline" className="w-full" onClick={() => setDialog('waitlist')}>
      <Hourglass /> Join waitlist
    </Button>
  ) : (
    <Button size="lg" className="w-full" onClick={() => setDialog('book')} disabled={!tier}>
      Book {qty > 1 ? `${qty} tickets` : 'ticket'} · {formatPrice((tier?.price || 0) * qty)}
    </Button>
  )

  return (
    <div className="pb-28 lg:pb-0">
      {/* hero image */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <EventImage event={event} w={1400} h={700} className="size-full scale-110 object-cover opacity-40 blur-2xl dark:opacity-25" />
        </div>
        <div className="container-page relative pt-6 pb-8">
          <Button to="/" variant="ghost" size="sm" className="mb-4 bg-card/70 backdrop-blur">
            <ArrowLeft /> All events
          </Button>
          <EventImage event={event} w={1400} h={700} className="aspect-[2/1] w-full rounded-2xl object-cover shadow-2xl sm:aspect-[21/9]" />
        </div>
      </div>

      <div className="container-page grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* details */}
        <article className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {event.featured && (
              <Badge variant="featured">
                <Star className="fill-current" /> Featured
              </Badge>
            )}
            {categoryOf(event) && (
              <Badge variant="outline">
                {categoryOf(event).emoji} {categoryOf(event).label}
              </Badge>
            )}
            <Badge variant={event.type === 'school' ? 'primary' : 'default'}>
              {event.type === 'school' ? <><GraduationCap /> {event.school}</> : 'Open to everyone'}
            </Badge>
            {ended && <Badge variant="outline">Ended</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-balance sm:text-4xl">{event.title}</h1>
          {event.ownerName && (
            <div className="mt-3 flex items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Hosted by{' '}
                <Link to={`/clubs/${event.ownerId}`} className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">
                  {event.ownerName}
                </Link>
              </p>
              <FollowButton clubId={event.ownerId} name={event.ownerName} />
            </div>
          )}

          <EventUpdates eventId={event.id} className="mt-6" />

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Fact icon={CalendarDays} label="Date" value={formatDate(event.date, { weekday: 'long', day: 'numeric', month: 'long' })} />
            <Fact icon={Clock} label="Time" value={formatTime(event.time)} />
            <Fact
              icon={MapPin}
              label="Venue"
              value={
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.mapQuery || event.venue)}`} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline">
                  {event.venue}
                </a>
              }
            />
          </div>

          <div className="mt-6 flex gap-2">
            <Button variant="outline" onClick={share}>
              <Share2 /> Share
            </Button>
            <SaveButton eventId={event.id} variant="button" />
            <CalendarButton event={event} className="[&>div]:left-0 [&>div]:right-auto" />
          </div>

          <h2 className="mt-10 text-lg font-bold">About this event</h2>
          <div className="mt-3 space-y-4 leading-relaxed whitespace-pre-line text-muted-foreground">{event.description || 'No description yet.'}</div>

          <div className="mt-10 rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <Users className="size-4" /> {s.booked.toLocaleString()} going
              </span>
              <span className="text-muted-foreground">{s.soldOut ? 'Sold out' : `${s.left.toLocaleString()} seats left`}</span>
            </div>
            <Progress value={s.pct} className="mt-3" />
          </div>
        </article>

        {/* booking panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="font-bold">Choose tickets</h2>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Ticket type">
              {tiers.map((t) => {
                const left = t.totalSlots - t.bookedSlots
                const selected = t.id === tierId
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setTierId(t.id)
                      setQty(1)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border-2 p-4 text-left transition-colors',
                      selected ? 'border-primary bg-primary-soft/40' : 'border-border hover:border-input',
                    )}
                  >
                    <div>
                      <p className="font-bold">{t.name}</p>
                      <p className={cn('text-xs', left <= 0 ? 'font-semibold text-danger' : left <= 20 ? 'font-semibold text-warning' : 'text-muted-foreground')}>
                        {left <= 0 ? 'Sold out · waitlist open' : `${left} left`}
                      </p>
                    </div>
                    <span className="font-extrabold">{formatPrice(t.price)}</span>
                  </button>
                )
              })}
            </div>

            {event.allowMultiple && !tierSoldOut && !ended && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-semibold">Quantity</span>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="icon-sm" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Fewer tickets">
                    <Minus />
                  </Button>
                  <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
                  <Button variant="outline" size="icon-sm" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="More tickets">
                    <Plus />
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-5 hidden lg:block">{action}</div>
            {event.allowMultiple && <p className="mt-3 text-center text-xs text-muted-foreground">Up to {event.maxTickets} tickets per person</p>}
          </div>
        </aside>
      </div>

      {/* mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 p-3 backdrop-blur-lg lg:hidden">{action}</div>

      {tier && (
        <>
          <BookingDialog open={dialog === 'book'} onClose={() => setDialog(null)} event={event} tier={tier} qty={qty} />
          <WaitlistDialog open={dialog === 'waitlist'} onClose={() => setDialog(null)} event={event} tier={tier} />
        </>
      )}
    </div>
  )
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}

function BookingDialog({ open, onClose, event, tier, qty }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const form = useAttendeeForm()
  const [step, setStep] = useState('details')
  const [submitting, setSubmitting] = useState(false)
  const [promo, setPromo] = useState(null)
  const isSchool = event.type === 'school'
  const gross = tier.price * qty
  const discount = promo ? promoDiscount(promo, tier.price, qty) : 0
  const total = gross - discount

  useEffect(() => {
    if (open) setStep('details')
  }, [open])

  // A code checked for one tier/quantity may not apply after changing them.
  useEffect(() => setPromo(null), [tier.id, qty])

  function next(e) {
    e.preventDefault()
    const errors = validateAttendee(form.values, isSchool)
    form.setErrors(errors)
    if (Object.keys(errors).length === 0) setStep('confirm')
  }

  async function confirm() {
    if (!user) {
      toast.error('Still connecting. Try again in a moment.')
      return
    }
    setSubmitting(true)
    const details = cleanAttendee(form.values, isSchool)
    try {
      const bookingId = await createBooking({ eventId: event.id, tierId: tier.id, uid: user.uid, details, quantity: qty, promoCode: promo?.code })
      toast.success(qty > 1 ? `${qty} tickets booked!` : 'You’re in! Ticket booked.')
      if (details.email) {
        // Fire and forget: email must never block the booking.
        const unsub = subscribeBooking(bookingId, (b) => {
          if (!b) return
          unsub()
          sendBookingConfirmation({ bookingId, booking: b, event })
        })
      }
      navigate(`/tickets/${bookingId}?new=1`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof BookingError ? err.message : 'Booking failed. Please try again.')
      setSubmitting(false)
    }
  }

  const d = form.values
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={step === 'details' ? 'Your details' : 'Confirm booking'}
      description={`${event.title} · ${tier.name}`}
      footer={
        step === 'details' ? (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="booking-form">Continue</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep('details')} disabled={submitting}>Back</Button>
            <Button onClick={confirm} loading={submitting}>Confirm · {formatPrice(total)}</Button>
          </>
        )
      }
    >
      {step === 'details' ? (
        <form id="booking-form" onSubmit={next} noValidate>
          <AttendeeFields form={form} isSchool={isSchool} emailHint="We’ll email your ticket here." />
        </form>
      ) : (
        <dl className="divide-y rounded-xl border text-sm">
          {[
            ['Event', event.title],
            ['When', `${formatDate(event.date)} · ${formatTime(event.time)}`],
            ['Ticket', `${tier.name} × ${qty}`],
            ['Name', d.fullName],
            ['Phone', d.phone],
            d.email && ['Email', d.email],
            isSchool && ['Reg. no.', d.regNumber],
          ]
            .filter(Boolean)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          <div className="flex justify-between gap-4 bg-muted/50 px-4 py-3">
            <dt className="font-bold">Total</dt>
            <dd className="text-right">
              {discount > 0 && <span className="mr-2 text-sm text-muted-foreground line-through">{formatPrice(gross)}</span>}
              <span className="text-lg font-extrabold text-primary">{formatPrice(total)}</span>
            </dd>
          </div>
        </dl>
      )}
      {step === 'confirm' && tier.price > 0 && (
        <PromoField eventId={event.id} tierId={tier.id} qty={qty} promo={promo} onChange={setPromo} discount={discount} />
      )}
      {step === 'confirm' && total > 0 && <p className="mt-3 text-xs text-muted-foreground">Payment is collected at the venue.</p>}
    </Dialog>
  )
}

function PromoField({ eventId, tierId, qty, promo, onChange, discount }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function apply(e) {
    e.preventDefault()
    setChecking(true)
    setError('')
    try {
      onChange(await checkPromo(eventId, code, tierId, qty))
    } catch (err) {
      setError(err instanceof PromoError ? err.message : 'Couldn’t check that code')
    } finally {
      setChecking(false)
    }
  }

  if (promo) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-success-soft px-3 py-2 text-sm">
        <span>
          <span className="font-mono font-bold">{promo.code}</span> · {promoLabel(promo)} <span className="font-semibold text-success">(−{formatPrice(discount)})</span>
        </span>
        <button onClick={() => onChange(null)} className="font-semibold text-muted-foreground hover:text-foreground">Remove</button>
      </div>
    )
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-sm font-semibold text-primary hover:underline">
        Have a promo code?
      </button>
    )
  }
  return (
    <form onSubmit={apply} className="mt-3 space-y-1.5">
      <div className="flex gap-2">
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="PROMO CODE"
          aria-label="Promo code"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-sm uppercase focus:border-primary focus:outline-none"
        />
        <Button type="submit" variant="outline" loading={checking}>Apply</Button>
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </form>
  )
}

function WaitlistDialog({ open, onClose, event, tier }) {
  const { user } = useAuth()
  const form = useAttendeeForm()
  const [submitting, setSubmitting] = useState(false)
  const isSchool = event.type === 'school'

  async function submit(e) {
    e.preventDefault()
    const errors = validateAttendee(form.values, isSchool)
    form.setErrors(errors)
    if (Object.keys(errors).length || !user) return
    setSubmitting(true)
    try {
      await joinWaitlist({ event, tierId: tier.id, uid: user.uid, details: cleanAttendee(form.values, isSchool) })
      toast.success('You’re on the waitlist. We’ll let you know if a seat opens up.')
      onClose()
    } catch (err) {
      toast[err instanceof AlreadyWaitlistedError ? 'info' : 'error'](err instanceof AlreadyWaitlistedError ? err.message : 'Could not join the waitlist.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Join the waitlist"
      description={`${tier.name} is sold out. If a seat opens up, the organizer can give it to you.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="waitlist-form" loading={submitting}>Join waitlist</Button>
        </>
      }
    >
      <form id="waitlist-form" onSubmit={submit} noValidate>
        <AttendeeFields form={form} isSchool={isSchool} emailHint="Add an email to be notified when you get a seat." />
      </form>
    </Dialog>
  )
}

function DetailSkeleton() {
  return (
    <div className="container-page space-y-6 py-8">
      <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

