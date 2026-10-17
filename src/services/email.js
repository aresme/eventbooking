import emailjs from '@emailjs/browser'
import { formatDate, formatPrice, formatTime } from '@/lib/utils'

const env = import.meta.env

export const emailEnabled = Boolean(env.VITE_EMAILJS_PUBLIC_KEY && env.VITE_EMAILJS_SERVICE_ID)

/**
 * Send an email through EmailJS. The template decides the subject and layout; the params below
 * are available in it as {{to_name}}, {{event_title}}, {{ticket_url}}, etc.
 * Failures are logged and swallowed so a booking never fails because of email.
 */
async function send(templateId, params) {
  if (!emailEnabled || !templateId || !params.to_email) return false
  try {
    await emailjs.send(env.VITE_EMAILJS_SERVICE_ID, templateId, params, { publicKey: env.VITE_EMAILJS_PUBLIC_KEY })
    return true
  } catch (err) {
    console.warn('Email failed', err)
    return false
  }
}

function eventParams(event) {
  return {
    event_title: event.title,
    event_date: formatDate(event.date),
    event_time: formatTime(event.time),
    event_venue: event.venue,
  }
}

export function sendBookingConfirmation({ bookingId, booking, event }) {
  return send(env.VITE_EMAILJS_TEMPLATE_BOOKING, {
    to_email: booking.email,
    to_name: booking.fullName,
    ...eventParams(event),
    tier_name: booking.tierName,
    quantity: booking.quantity,
    total: formatPrice(booking.unitPrice * booking.quantity - (booking.discount || 0)),
    ticket_codes: booking.ticketCodes.join(', '),
    ticket_url: `${window.location.origin}/tickets/${bookingId}`,
  })
}

export function sendWaitlistPromotion({ bookingId, entry, event }) {
  return send(env.VITE_EMAILJS_TEMPLATE_WAITLIST, {
    to_email: entry.email,
    to_name: entry.fullName,
    ...eventParams(event),
    tier_name: entry.tierName,
    ticket_url: `${window.location.origin}/tickets/${bookingId}`,
  })
}

export const updateEmailsEnabled = emailEnabled && Boolean(env.VITE_EMAILJS_TEMPLATE_UPDATE)

/**
 * Email an organizer update to every confirmed attendee who gave an email (one email per address).
 * EmailJS free plan allows 200 emails/month, so the caller shows the count first.
 */
export async function sendUpdateToAttendees({ event, message, bookings }) {
  const recipients = [...new Map(bookings.filter((b) => b.status === 'confirmed' && b.email).map((b) => [b.email, b])).values()]
  let sent = 0
  for (const b of recipients) {
    const ok = await send(env.VITE_EMAILJS_TEMPLATE_UPDATE, {
      to_email: b.email,
      to_name: b.fullName,
      ...eventParams(event),
      message,
      ticket_url: `${window.location.origin}/tickets/${b.id}`,
    })
    if (ok) sent++
  }
  return { sent, total: recipients.length }
}

export function attendeeEmailCount(bookings) {
  return new Set(bookings.filter((b) => b.status === 'confirmed' && b.email).map((b) => b.email)).size
}
