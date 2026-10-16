import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { toPng } from 'html-to-image'
import { toast } from 'sonner'
import { CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Download, MapPin } from 'lucide-react'
import { cn, formatDate, formatPrice, formatTime } from '@/lib/utils'
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar'
import { Button } from './ui/button'
import { Badge } from './ui/misc'
import { WhatsAppIcon } from './social-icons'

/** One booking can hold several tickets; each has its own QR code. */
export function TicketCard({ booking, event }) {
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const ticketRef = useRef(null)
  const ticket = booking.tickets[index]
  const cancelled = booking.status === 'cancelled'

  async function save() {
    setSaving(true)
    try {
      const url = await toPng(ticketRef.current, { pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a')
      a.href = url
      a.download = `UniVibe-${ticket.code}.png`
      a.click()
    } catch (err) {
      console.error(err)
      toast.error('Could not save the ticket image')
    } finally {
      setSaving(false)
    }
  }

  function share() {
    const text = `🎉 I'm going to *${event.title}*!\n📅 ${formatDate(event.date)} · ${formatTime(event.time)}\n📍 ${event.venue}\n\nGet your ticket: ${window.location.origin}/events/${event.id}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <div className="space-y-4">
      <div ref={ticketRef} className="overflow-hidden rounded-2xl bg-card shadow-card ring-1 ring-border">
        <div className="relative bg-primary px-6 pt-6 pb-8 text-primary-foreground">
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">UniVibe ticket</p>
          <h2 className="mt-1 text-xl font-extrabold leading-tight">{event.title}</h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm opacity-90">
            <MapPin className="size-4" /> {event.venue}
          </p>
        </div>

        <div className="ticket-notch relative -mt-3 bg-card px-6 pt-6 pb-2">
          <div className="absolute inset-x-6 top-0 border-t-2 border-dashed" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Item label="Date" value={formatDate(event.date)} />
            <Item label="Time" value={formatTime(event.time)} />
            <Item label="Name" value={booking.fullName} />
            <Item label="Ticket" value={booking.tierName} />
            {booking.regNumber && <Item label="Reg. no." value={booking.regNumber} />}
            <Item label="Price" value={formatPrice(booking.unitPrice)} />
          </dl>
        </div>

        <div className="flex flex-col items-center gap-3 bg-card px-6 pt-4 pb-6">
          <div className={cn('rounded-xl bg-white p-3 ring-1 ring-border', (cancelled || ticket.checkedIn) && 'opacity-30')}>
            <QRCodeSVG value={ticket.code} size={168} level="M" />
          </div>
          <p className="font-mono text-2xl font-extrabold tracking-[0.15em]">{ticket.code}</p>
          {cancelled ? (
            <Badge variant="danger">Cancelled</Badge>
          ) : ticket.checkedIn ? (
            <Badge variant="success">
              <CheckCircle2 /> Checked in
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">Show this code at the entrance</p>
          )}
        </div>
      </div>

      {booking.tickets.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => setIndex((i) => i - 1)} disabled={index === 0} aria-label="Previous ticket">
            <ChevronLeft />
          </Button>
          <span className="text-sm font-semibold">
            Ticket {index + 1} of {booking.tickets.length}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setIndex((i) => i + 1)} disabled={index === booking.tickets.length - 1} aria-label="Next ticket">
            <ChevronRight />
          </Button>
        </div>
      )}

      {!cancelled && (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={save} loading={saving}>
            {!saving && <Download />} Save
          </Button>
          <Button variant="outline" onClick={share}>
            <WhatsAppIcon /> Share
          </Button>
          <CalendarButton event={event} />
        </div>
      )}
    </div>
  )
}

function Item({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-bold">{value}</dd>
    </div>
  )
}

export function CalendarButton({ event, className }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn('relative', className)}>
      <Button variant="outline" className="w-full" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CalendarPlus /> Calendar
      </Button>
      {open && (
        <div className="animate-fade-up absolute right-0 bottom-full z-10 mb-2 w-48 overflow-hidden rounded-xl border bg-card p-1 shadow-xl" onClick={() => setOpen(false)}>
          <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">Google Calendar</a>
          <a href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">Outlook</a>
          <button onClick={() => downloadIcs(event)} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted">Apple / .ics file</button>
        </div>
      )}
    </div>
  )
}
