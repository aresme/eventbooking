// Runs the real app services (src/services) against the emulators + firestore.rules,
// so a rule change that breaks booking, cancelling or check-in fails here.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { createUserWithEmailAndPassword, signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { saveEvent } from '@/services/events'
import { BookingError, cancelOwnBooking, checkInTicket, createBooking, findBookingByCode, promoteFromWaitlist, staffCancelBooking } from '@/services/bookings'
import { AlreadyWaitlistedError, joinWaitlist } from '@/services/waitlist'

let env
const details = { fullName: 'Jane Doe', phone: '0712345678', email: '', regNumber: '', school: '' }
const staffUsers = {}

async function asStaff(name) {
  await signOut(auth)
  await signInWithEmailAndPassword(auth, `${name}@test.com`, 'password123')
  return { ...staffUsers[name], uid: auth.currentUser.uid }
}

async function asVisitor() {
  await signOut(auth)
  await signInAnonymously(auth)
  return auth.currentUser.uid
}

async function readEvent(id) {
  let data
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'events', id))).data()
  })
  return data
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-univibe-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
  await env.clearFirestore()
  for (const [name, role] of [['admin', 'admin'], ['org', 'organizer']]) {
    try {
      await createUserWithEmailAndPassword(auth, `${name}@test.com`, 'password123')
    } catch {
      await signInWithEmailAndPassword(auth, `${name}@test.com`, 'password123')
    }
    const uid = auth.currentUser.uid
    staffUsers[name] = { uid, role, email: `${name}@test.com`, profile: { displayName: name } }
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', uid), { role, email: `${name}@test.com`, displayName: name }))
  }
}, 30000)

afterAll(async () => {
  await signOut(auth)
  await env?.cleanup()
})

const values = (over = {}) => ({
  title: 'Hackathon',
  description: 'Build things',
  type: 'normal',
  school: '',
  date: '2099-05-01',
  time: '09:00',
  venue: 'Lab 1',
  mapQuery: '',
  image: '',
  allowMultiple: true,
  maxTickets: 3,
  ...over,
})

describe('full booking lifecycle with real services', () => {
  let eventId
  let org
  let visitor
  let bookingId

  it('organizer creates an event (pending) and admin publishes it', async () => {
    org = await asStaff('org')
    eventId = await saveEvent({ values: values(), tiers: [{ id: 'reg', name: 'Regular', price: 200, totalSlots: 3 }], user: org })
    expect((await readEvent(eventId)).status).toBe('pending')

    await asStaff('admin')
    const { setEventStatus } = await import('@/services/events')
    await setEventStatus({ id: eventId, ownerId: org.uid, title: 'Hackathon' }, 'published', staffUsers.admin)
    expect((await readEvent(eventId)).status).toBe('published')
  })

  it('a visitor books 2 tickets', async () => {
    visitor = await asVisitor()
    bookingId = await createBooking({ eventId, tierId: 'reg', uid: visitor, details, quantity: 2 })
    const ev = await readEvent(eventId)
    expect(ev.tiers.reg.bookedSlots).toBe(2)
  })

  it('the same visitor cannot exceed maxTickets', async () => {
    await expect(createBooking({ eventId, tierId: 'reg', uid: visitor, details, quantity: 2 })).rejects.toBeInstanceOf(BookingError)
  })

  it('another visitor takes the last seat; a third is told it sold out', async () => {
    const v2 = await asVisitor()
    await createBooking({ eventId, tierId: 'reg', uid: v2, details, quantity: 1 })
    const v3 = await asVisitor()
    await expect(createBooking({ eventId, tierId: 'reg', uid: v3, details, quantity: 1 })).rejects.toThrow(/sold out/)

    const event = { id: eventId, ownerId: org.uid, title: 'Hackathon', tiers: { reg: { name: 'Regular' } } }
    await joinWaitlist({ event, tierId: 'reg', uid: v3, details })
    await expect(joinWaitlist({ event, tierId: 'reg', uid: v3, details })).rejects.toBeInstanceOf(AlreadyWaitlistedError)
  })

  it('concurrent bookings for the last seat never oversell', async () => {
    const id = await saveEvent({ values: values({ title: 'Tiny' }), tiers: [{ id: 'one', name: 'Only', price: 0, totalSlots: 1 }], user: await asStaff('admin') })
    // Two visitors racing: sign both in up front and fire bookings together.
    const a = await asVisitor()
    const results = await Promise.allSettled([
      createBooking({ eventId: id, tierId: 'one', uid: a, details, quantity: 1 }),
      createBooking({ eventId: id, tierId: 'one', uid: a, details, quantity: 1 }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await readEvent(id)).tiers.one.bookedSlots).toBe(1)
  })

  it('the visitor cancels their own booking and seats are released', async () => {
    await signOut(auth)
    // Re-use the first visitor's identity through a fresh anonymous sign-in is impossible,
    // so book again as a new visitor and cancel that booking.
    await asStaff('admin')
    const id = await saveEvent({ values: values({ title: 'Cancel me' }), tiers: [{ id: 'g', name: 'General', price: 0, totalSlots: 5 }], user: staffUsers.admin })
    const v = await asVisitor()
    const bId = await createBooking({ eventId: id, tierId: 'g', uid: v, details, quantity: 2 })
    await cancelOwnBooking({ id: bId, eventId: id }, v)
    expect((await readEvent(id)).tiers.g.bookedSlots).toBe(0)
    // and can book again afterwards (holder count went back down)
    await createBooking({ eventId: id, tierId: 'g', uid: v, details, quantity: 3 })
  })

  it('staff cancels a booking, promotes from the waitlist and checks in', async () => {
    const orgUser = await asStaff('org')
    const booking = await findBookingByCode((await getBookingCodes(bookingId))[0], orgUser)
    expect(booking.id).toBe(bookingId)

    await staffCancelBooking(booking, orgUser)
    expect((await readEvent(eventId)).tiers.reg.bookedSlots).toBe(1)

    const entry = await getWaitlistEntry(eventId)
    const promotedId = await promoteFromWaitlist(entry, orgUser)
    expect((await readEvent(eventId)).tiers.reg.bookedSlots).toBe(2)

    const code = (await getBookingCodes(promotedId))[0]
    expect((await checkInTicket(promotedId, code, orgUser)).result).toBe('ok')
    expect((await checkInTicket(promotedId, code, orgUser)).result).toBe('already')
    expect((await checkInTicket(bookingId, (await getBookingCodes(bookingId))[0], orgUser)).result).toBe('cancelled')
  })
})

async function getBookingCodes(id) {
  return (await getDoc(doc(db, 'bookings', id))).data().ticketCodes
}

async function getWaitlistEntry(eventId) {
  let entry
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { getDocs, query, collection, where } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(ctx.firestore(), 'waitlists'), where('eventId', '==', eventId)))
    entry = { id: snap.docs[0].id, ...snap.docs[0].data() }
  })
  return entry
}
