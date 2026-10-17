import emailjs from '@emailjs/browser'
import { formatDate, formatPrice, formatTime } from '@/lib/utils'

const env = import.meta.env

// Two EmailJS templates (see README):
//   BOOKING: ticket confirmation, with event fields like {{event_title}} and {{ticket_url}}
//   NOTICE:  waitlist seats and organizer updates, with {{subject}}, {{heading}}, {{message}}
const ready = Boolean(env.VITE_EMAILJS_PUBLIC_KEY && env.VITE_EMAILJS_SERVICE_ID)
export const emailEnabled = ready && Boolean(env.VITE_EMAILJS_TEMPLATE_BOOKING)
export const updateEmailsEnabled = ready && Boolean(env.VITE_EMAILJS_TEMPLATE_NOTICE)

/** Send one email. Failures are logged and swallowed so a booking never fails because of email. */
async function send(templateId, params) {
  if (!ready || !templateId || !params.to_email) return false
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

const firstName = (n) => (n || '').split(' ')[0]

export function sendBookingConfirmation({ bookingId, booking, event }) {
  return send(env.VITE_EMAILJS_TEMPLATE_BOOKING, {
    to_email: booking.email,
    to_name: firstName(booking.fullName),
    ...eventParams(event),
    tier_name: booking.tierName,
    quantity: booking.quantity,
    total: formatPrice(booking.unitPrice * booking.quantity - (booking.discount || 0)),
    ticket_codes: booking.ticketCodes.join(', '),
    ticket_url: `${window.location.origin}/tickets/${bookingId}`,
  })
}

export function sendWaitlistPromotion({ bookingId, entry, event }) {
  return send(env.VITE_EMAILJS_TEMPLATE_NOTICE, {
    to_email: entry.email,
    to_name: firstName(entry.fullName),
    ...eventParams(event),
    subject: `A seat opened up: ${event.title}`,
    heading: 'Good news, you got a seat! 🎉',
    message: `You've been given a ${entry.tierName} ticket for ${event.title}. Open your ticket below and show the QR code at the entrance.`,
    ticket_url: `${window.location.origin}/tickets/${bookingId}`,
  })
}

/**
 * Email an organizer update to every confirmed attendee who gave an email (one email per address).
 * EmailJS free plan allows 200 emails/month, so the caller shows the count first.
 */
export async function sendUpdateToAttendees({ event, message, bookings }) {
  const recipients = [...new Map(bookings.filter((b) => b.status === 'confirmed' && b.email).map((b) => [b.email, b])).values()]
  let sent = 0
  for (const b of recipients) {
    const ok = await send(env.VITE_EMAILJS_TEMPLATE_NOTICE, {
      to_email: b.email,
      to_name: firstName(b.fullName),
      ...eventParams(event),
      subject: `Update: ${event.title}`,
      heading: 'An update from the organizer 📣',
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
