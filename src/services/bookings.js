import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ticketCode } from '@/lib/utils'
import { logActivity } from './logs'

const bookingsCol = collection(db, 'bookings')
const withId = (snap) => ({ id: snap.id, ...snap.data() })

export class BookingError extends Error {}

function holderRef(eventId, uid) {
  return doc(db, 'events', eventId, 'holders', uid)
}

function newTickets(quantity) {
  const codes = new Set()
  while (codes.size < quantity) codes.add(ticketCode())
  const ticketCodes = [...codes]
  return { ticketCodes, tickets: ticketCodes.map((code) => ({ code, checkedIn: false })) }
}

/**
 * Book `quantity` tickets in one transaction: re-reads the event so two people can't take the
 * last seat at the same time. firestore.rules check the same limits on the server.
 */
export async function createBooking({ eventId, tierId, uid, details, quantity }) {
  const bookingRef = doc(bookingsCol)

  await runTransaction(db, async (tx) => {
    const eventSnap = await tx.get(doc(db, 'events', eventId))
    const holderSnap = await tx.get(holderRef(eventId, uid))
    if (!eventSnap.exists()) throw new BookingError('This event no longer exists.')

    const event = eventSnap.data()
    const tier = event.tiers?.[tierId]
    if (event.status !== 'published') throw new BookingError('This event is not open for booking.')
    if (!tier) throw new BookingError('This ticket type is no longer available.')

    const left = tier.totalSlots - tier.bookedSlots
    if (left < quantity) {
      throw new BookingError(left > 0 ? `Only ${left} ticket${left > 1 ? 's' : ''} left for ${tier.name}.` : `${tier.name} just sold out.`)
    }

    const held = holderSnap.exists() ? holderSnap.data().count : 0
    const limitPerPerson = event.allowMultiple ? event.maxTickets : 1
    if (held + quantity > limitPerPerson) {
      throw new BookingError(
        held > 0
          ? `You already have ${held} ticket${held > 1 ? 's' : ''} for this event (limit ${limitPerPerson}).`
          : `You can book up to ${limitPerPerson} ticket${limitPerPerson > 1 ? 's' : ''}.`,
      )
    }

    tx.set(bookingRef, {
      eventId,
      tierId,
      userId: uid,
      ownerId: event.ownerId,
      eventTitle: event.title,
      tierName: tier.name,
      unitPrice: tier.price,
      fullName: details.fullName,
      phone: details.phone,
      email: details.email || '',
      regNumber: details.regNumber || '',
      school: details.school || '',
      quantity,
      ...newTickets(quantity),
      status: 'confirmed',
      source: 'web',
      bookedAt: serverTimestamp(),
    })
    tx.update(eventSnap.ref, { [`tiers.${tierId}.bookedSlots`]: tier.bookedSlots + quantity, txn: bookingRef.id })
    tx.set(holderRef(eventId, uid), { count: held + quantity, txn: bookingRef.id })
  })

  return bookingRef.id
}

/** Visitor cancels their own booking; the seats go back on sale. */
export async function cancelOwnBooking(booking, uid) {
  await runTransaction(db, async (tx) => {
    const ref = doc(bookingsCol, booking.id)
    const eventRef = doc(db, 'events', booking.eventId)
    const [snap, eventSnap, holderSnap] = await Promise.all([tx.get(ref), tx.get(eventRef), tx.get(holderRef(booking.eventId, uid))])
    const current = snap.data()
    if (current.status !== 'confirmed') throw new BookingError('This booking is already cancelled.')
    const booked = eventSnap.data().tiers[current.tierId].bookedSlots
    const held = holderSnap.exists() ? holderSnap.data().count : current.quantity

    tx.update(ref, { status: 'cancelled' })
    tx.update(eventRef, { [`tiers.${current.tierId}.bookedSlots`]: Math.max(0, booked - current.quantity), txn: booking.id })
    tx.set(holderRef(booking.eventId, uid), { count: Math.max(0, held - current.quantity), txn: booking.id })
  })
}

/** Staff cancels any booking of an event they manage. */
export async function staffCancelBooking(booking, user) {
  await runTransaction(db, async (tx) => {
    const ref = doc(bookingsCol, booking.id)
    const eventRef = doc(db, 'events', booking.eventId)
    const hRef = holderRef(booking.eventId, booking.userId)
    const [snap, eventSnap, holderSnap] = await Promise.all([tx.get(ref), tx.get(eventRef), tx.get(hRef)])
    const current = snap.data()
    if (current.status !== 'confirmed') throw new BookingError('This booking is already cancelled.')

    tx.update(ref, { status: 'cancelled' })
    if (eventSnap.exists()) {
      const booked = eventSnap.data().tiers?.[current.tierId]?.bookedSlots ?? 0
      tx.update(eventRef, { [`tiers.${current.tierId}.bookedSlots`]: Math.max(0, booked - current.quantity) })
    }
    if (holderSnap.exists()) {
      tx.update(hRef, { count: Math.max(0, holderSnap.data().count - current.quantity), txn: booking.id })
    }
  })
  await logActivity(user, booking.ownerId, 'booking_cancelled', {
    eventId: booking.eventId,
    eventTitle: booking.eventTitle,
    attendeeName: booking.fullName,
    ticketCode: booking.ticketCodes?.[0],
  })
}

export function subscribeBooking(bookingId, onData, onError) {
  return onSnapshot(doc(bookingsCol, bookingId), (snap) => onData(snap.exists() ? withId(snap) : null), onError)
}

export function subscribeMyBookings(uid, onData, onError) {
  return onSnapshot(
    query(bookingsCol, where('userId', '==', uid), orderBy('bookedAt', 'desc')),
    (snap) => onData(snap.docs.map(withId)),
    onError,
  )
}

export function subscribeManagedBookings({ uid, role }, onData, onError) {
  const base = role === 'admin' ? [] : [where('ownerId', '==', uid)]
  return onSnapshot(
    query(bookingsCol, ...base, orderBy('bookedAt', 'desc')),
    (snap) => onData(snap.docs.map(withId)),
    onError,
  )
}

export async function findBookingByCode(code, { uid, role }) {
  const base = role === 'admin' ? [] : [where('ownerId', '==', uid)]
  const snap = await getDocs(query(bookingsCol, ...base, where('ticketCodes', 'array-contains', code), limit(1)))
  return snap.empty ? null : withId(snap.docs[0])
}

/**
 * Mark one ticket of a booking as checked in.
 * Returns 'ok' | 'already' | 'cancelled'.
 */
export async function checkInTicket(bookingId, code, user) {
  let result = 'ok'
  let booking
  await runTransaction(db, async (tx) => {
    const ref = doc(bookingsCol, bookingId)
    const snap = await tx.get(ref)
    booking = snap.data()
    if (booking.status !== 'confirmed') {
      result = 'cancelled'
      return
    }
    const tickets = booking.tickets.map((t) => ({ ...t }))
    const ticket = tickets.find((t) => t.code === code)
    if (ticket.checkedIn) {
      result = 'already'
      return
    }
    ticket.checkedIn = true
    ticket.checkedInAt = new Date().toISOString()
    tx.update(ref, { tickets })
  })
  if (result === 'ok') {
    await logActivity(user, booking.ownerId, 'check_in', {
      eventId: booking.eventId,
      eventTitle: booking.eventTitle,
      attendeeName: booking.fullName,
      ticketCode: code,
    })
  }
  return { result, booking: { ...booking, id: bookingId } }
}

export async function updateBookingDetails(bookingId, values) {
  await updateDoc(doc(bookingsCol, bookingId), values)
}

/** Move a waitlisted person into a confirmed booking (staff only). */
export async function promoteFromWaitlist(entry, user) {
  const bookingRef = doc(bookingsCol)
  await runTransaction(db, async (tx) => {
    const eventRef = doc(db, 'events', entry.eventId)
    const hRef = holderRef(entry.eventId, entry.userId)
    const [eventSnap, holderSnap] = await Promise.all([tx.get(eventRef), tx.get(hRef)])
    if (!eventSnap.exists()) throw new BookingError('Event not found.')
    const event = eventSnap.data()
    const tier = event.tiers?.[entry.tierId]
    if (!tier) throw new BookingError('That ticket type no longer exists.')
    if (tier.bookedSlots >= tier.totalSlots) {
      throw new BookingError(`No free seats in ${tier.name}. Cancel a booking or add seats first.`)
    }

    tx.set(bookingRef, {
      eventId: entry.eventId,
      tierId: entry.tierId,
      userId: entry.userId,
      ownerId: event.ownerId,
      eventTitle: event.title,
      tierName: tier.name,
      unitPrice: tier.price,
      fullName: entry.fullName,
      phone: entry.phone,
      email: entry.email || '',
      regNumber: entry.regNumber || '',
      school: entry.school || '',
      quantity: 1,
      ...newTickets(1),
      status: 'confirmed',
      source: 'waitlist',
      bookedAt: serverTimestamp(),
    })
    tx.update(eventRef, { [`tiers.${entry.tierId}.bookedSlots`]: increment(1) })
    tx.set(hRef, { count: (holderSnap.exists() ? holderSnap.data().count : 0) + 1, txn: bookingRef.id })
    tx.delete(doc(db, 'waitlists', entry.id))
  })
  await logActivity(user, entry.ownerId, 'waitlist_promoted', {
    eventId: entry.eventId,
    attendeeName: entry.fullName,
  })
  return bookingRef.id
}
