// Firestore security rules tests. Run with: npm run test:rules (starts the emulator).
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

let env

const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
const staff = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.com`, firebase: { sign_in_provider: 'password' } }).firestore()

const baseEvent = (over = {}) => ({
  title: 'Freshers Night',
  description: '',
  type: 'normal',
  school: '',
  date: '2099-01-01',
  time: '18:00',
  venue: 'Hall',
  status: 'published',
  featured: false,
  ownerId: 'org1',
  allowMultiple: false,
  maxTickets: 1,
  tiers: { t1: { name: 'General', price: 100, totalSlots: 2, bookedSlots: 0, order: 0 } },
  ...over,
})

const bookingData = (uid, over = {}) => ({
  eventId: 'e1',
  tierId: 't1',
  userId: uid,
  ownerId: 'org1',
  eventTitle: 'Freshers Night',
  tierName: 'General',
  unitPrice: 100,
  fullName: 'Jane Doe',
  phone: '0712345678',
  email: '',
  regNumber: '',
  school: '',
  quantity: 1,
  tickets: [{ code: 'UV-AAAAAA', checkedIn: false }],
  ticketCodes: ['UV-AAAAAA'],
  status: 'confirmed',
  source: 'web',
  bookedAt: serverTimestamp(),
  ...over,
})

/** Mirrors services/bookings.js createBooking (without the read, which the test controls). */
function bookBatch(db, uid, { bookingId = 'b1', booked = 0, held = 0, qty = 1, eventId = 'e1', counter, over } = {}) {
  const batch = writeBatch(db)
  const codes = Array.from({ length: qty }, (_, i) => `UV-${bookingId}${i}`)
  batch.set(doc(db, 'bookings', bookingId), bookingData(uid, { eventId, unitPrice: eventId === 'e3' ? 0 : 100, quantity: qty, ticketCodes: codes, tickets: codes.map((code) => ({ code, checkedIn: false })), ...over }))
  batch.update(doc(db, 'events', eventId), { 'tiers.t1.bookedSlots': counter ?? booked + qty, txn: bookingId })
  batch.set(doc(db, 'events', eventId, 'holders', uid), { count: held + qty, txn: bookingId })
  return batch.commit()
}

async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()))
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-univibe-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(() => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await seed(async (db) => {
    await setDoc(doc(db, 'users/admin1'), { role: 'admin', email: 'admin1@test.com', displayName: 'Admin' })
    await setDoc(doc(db, 'users/org1'), { role: 'organizer', email: 'org1@test.com', displayName: 'Org One' })
    await setDoc(doc(db, 'users/org2'), { role: 'organizer', email: 'org2@test.com', displayName: 'Org Two' })
    await setDoc(doc(db, 'users/pend1'), { role: 'pending', email: 'pend1@test.com', displayName: 'Pending' })
    await setDoc(doc(db, 'events/e1'), baseEvent())
    await setDoc(doc(db, 'events/e2'), baseEvent({ status: 'pending' }))
    await setDoc(doc(db, 'events/e3'), baseEvent({ allowMultiple: true, maxTickets: 3, tiers: { t1: { name: 'General', price: 0, totalSlots: 10, bookedSlots: 0, order: 0 } } }))
  })
})

describe('events', () => {
  it('visitors read published events only', async () => {
    await assertSucceeds(getDoc(doc(anon('v1'), 'events/e1')))
    await assertFails(getDoc(doc(anon('v1'), 'events/e2')))
    await assertSucceeds(getDocs(query(collection(anon('v1'), 'events'), where('status', '==', 'published'))))
    await assertFails(getDocs(collection(anon('v1'), 'events')))
  })

  it('visitors cannot edit events (price, capacity, title)', async () => {
    await assertFails(updateDoc(doc(anon('v1'), 'events/e1'), { 'tiers.t1.price': 0 }))
    await assertFails(updateDoc(doc(anon('v1'), 'events/e1'), { 'tiers.t1.totalSlots': 999 }))
    await assertFails(updateDoc(doc(anon('v1'), 'events/e1'), { title: 'hacked' }))
    await assertFails(updateDoc(doc(anon('v1'), 'events/e1'), { 'tiers.t1.bookedSlots': 0, txn: 'nope' }))
  })

  it('organizers create pending events and cannot publish or feature them', async () => {
    const db = staff('org1')
    await assertSucceeds(setDoc(doc(db, 'events/new1'), baseEvent({ status: 'pending' })))
    await assertFails(setDoc(doc(db, 'events/new2'), baseEvent({ status: 'published' })))
    await assertFails(updateDoc(doc(db, 'events/e2'), { status: 'published' }))
    await assertFails(updateDoc(doc(db, 'events/e1'), { featured: true }))
    await assertSucceeds(updateDoc(doc(db, 'events/e1'), { status: 'hidden' }))
  })

  it("organizers cannot touch other organizers' events", async () => {
    const db = staff('org2')
    await assertFails(getDoc(doc(db, 'events/e2')))
    await assertFails(updateDoc(doc(db, 'events/e1'), { title: 'mine now' }))
    await assertFails(setDoc(doc(db, 'events/x'), baseEvent({ status: 'pending' })))
  })

  it('pending organizers have no staff rights', async () => {
    await assertFails(setDoc(doc(staff('pend1'), 'events/x'), baseEvent({ ownerId: 'pend1', status: 'pending' })))
  })

  it('admins can publish and feature', async () => {
    await assertSucceeds(updateDoc(doc(staff('admin1'), 'events/e2'), { status: 'published', featured: true }))
  })
})

describe('booking', () => {
  it('a visitor can book a published event', async () => {
    await assertSucceeds(bookBatch(anon('v1'), 'v1'))
  })

  it('rejects overbooking past capacity', async () => {
    await seed((db) => updateDoc(doc(db, 'events/e3'), { 'tiers.t1.totalSlots': 2, 'tiers.t1.bookedSlots': 2 }))
    await assertFails(bookBatch(anon('v1'), 'v1', { eventId: 'e3', booked: 2 }))
  })

  it('rejects a counter that does not match the quantity', async () => {
    await assertFails(bookBatch(anon('v1'), 'v1', { eventId: 'e3', qty: 2, counter: 1 }))
  })

  it('rejects a booking without the counter update', async () => {
    const db = anon('v1')
    await assertFails(setDoc(doc(db, 'bookings/solo'), bookingData('v1')))
  })

  it('rejects a booking with a fake price', async () => {
    await assertFails(bookBatch(anon('v1'), 'v1', { over: { unitPrice: 0 } }))
  })

  it('rejects booking an unpublished event', async () => {
    await assertFails(bookBatch(anon('v1'), 'v1', { eventId: 'e2' }))
  })

  it('enforces one ticket per person when allowMultiple is off', async () => {
    await assertSucceeds(bookBatch(anon('v1'), 'v1', { bookingId: 'b1' }))
    await assertFails(bookBatch(anon('v1'), 'v1', { bookingId: 'b2', booked: 1, held: 0 }))
    await assertFails(bookBatch(anon('v1'), 'v1', { bookingId: 'b3', booked: 1, held: 1 }))
  })

  it('enforces maxTickets per person', async () => {
    await assertSucceeds(bookBatch(anon('v1'), 'v1', { eventId: 'e3', qty: 3 }))
    await assertFails(bookBatch(anon('v1'), 'v1', { eventId: 'e3', bookingId: 'b2', booked: 3, held: 3 }))
  })

  it('a visitor cannot book on behalf of someone else', async () => {
    await assertFails(bookBatch(anon('v1'), 'v1', { over: { userId: 'v2' } }))
  })

  it('rejects invalid phone numbers', async () => {
    await assertFails(bookBatch(anon('v1'), 'v1', { over: { phone: '12345' } }))
  })
})

describe('booking privacy & cancel', () => {
  beforeEach(async () => {
    await bookBatch(anon('v1'), 'v1')
  })

  it('only the owner and the event organizer can list bookings', async () => {
    await assertSucceeds(getDocs(query(collection(anon('v1'), 'bookings'), where('userId', '==', 'v1'))))
    await assertFails(getDocs(query(collection(anon('v2'), 'bookings'), where('userId', '==', 'v1'))))
    await assertFails(getDocs(collection(anon('v2'), 'bookings')))
    await assertSucceeds(getDocs(query(collection(staff('org1'), 'bookings'), where('ownerId', '==', 'org1'))))
    await assertFails(getDocs(query(collection(staff('org2'), 'bookings'), where('ownerId', '==', 'org1'))))
    await assertSucceeds(getDocs(collection(staff('admin1'), 'bookings')))
  })

  it('the owner can cancel and the seat is released', async () => {
    const db = anon('v1')
    const batch = writeBatch(db)
    batch.update(doc(db, 'bookings/b1'), { status: 'cancelled' })
    batch.update(doc(db, 'events/e1'), { 'tiers.t1.bookedSlots': 0, txn: 'b1' })
    batch.set(doc(db, 'events/e1/holders/v1'), { count: 0, txn: 'b1' })
    await assertSucceeds(batch.commit())
  })

  it('cancelling cannot release more seats than booked', async () => {
    await seed((db) => updateDoc(doc(db, 'events/e1'), { 'tiers.t1.bookedSlots': 2 }))
    const db = anon('v1')
    const batch = writeBatch(db)
    batch.update(doc(db, 'bookings/b1'), { status: 'cancelled' })
    batch.update(doc(db, 'events/e1'), { 'tiers.t1.bookedSlots': 0, txn: 'b1' })
    batch.set(doc(db, 'events/e1/holders/v1'), { count: 0, txn: 'b1' })
    await assertFails(batch.commit())
  })

  it("other visitors cannot cancel someone's booking", async () => {
    const db = anon('v2')
    const batch = writeBatch(db)
    batch.update(doc(db, 'bookings/b1'), { status: 'cancelled' })
    batch.update(doc(db, 'events/e1'), { 'tiers.t1.bookedSlots': 0, txn: 'b1' })
    await assertFails(batch.commit())
  })

  it('visitors cannot check themselves in', async () => {
    await assertFails(updateDoc(doc(anon('v1'), 'bookings/b1'), { tickets: [{ code: 'UV-b10', checkedIn: true }] }))
  })

  it('the organizer can check in', async () => {
    await assertSucceeds(updateDoc(doc(staff('org1'), 'bookings/b1'), { tickets: [{ code: 'UV-b10', checkedIn: true }] }))
    await assertFails(updateDoc(doc(staff('org2'), 'bookings/b1'), { tickets: [{ code: 'UV-b10', checkedIn: true }] }))
  })
})

describe('waitlist', () => {
  const entry = (uid) => ({ eventId: 'e1', tierId: 't1', userId: uid, ownerId: 'org1', fullName: 'Jane Doe', phone: '0712345678', email: '', joinedAt: serverTimestamp() })

  it('a visitor can join once', async () => {
    const db = anon('v1')
    await assertSucceeds(setDoc(doc(db, 'waitlists/e1_t1_v1'), entry('v1')))
    await assertFails(setDoc(doc(db, 'waitlists/e1_t1_v1'), entry('v1')))
    await assertFails(setDoc(doc(db, 'waitlists/e1_t1_other'), entry('v1')))
  })

  it('visitors cannot see other people on the waitlist', async () => {
    await setDoc(doc(anon('v1'), 'waitlists/e1_t1_v1'), entry('v1'))
    await assertFails(getDoc(doc(anon('v2'), 'waitlists/e1_t1_v1')))
    await assertSucceeds(getDoc(doc(anon('v2'), 'waitlists/e1_t1_v2')))
    await assertSucceeds(getDocs(query(collection(staff('org1'), 'waitlists'), where('ownerId', '==', 'org1'))))
  })
})

describe('users & settings', () => {
  it('sign-up can only create a pending profile', async () => {
    await assertSucceeds(setDoc(doc(staff('new1'), 'users/new1'), { role: 'pending', email: 'n@x.com', displayName: 'N', org: '', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(staff('new2'), 'users/new2'), { role: 'admin', email: 'n@x.com', displayName: 'N', org: '', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(anon('v1'), 'users/v1'), { role: 'pending', email: '', displayName: 'N', org: '', createdAt: serverTimestamp() }))
  })

  it('users cannot promote themselves', async () => {
    await assertFails(updateDoc(doc(staff('org1'), 'users/org1'), { role: 'admin' }))
    await assertSucceeds(updateDoc(doc(staff('admin1'), 'users/org1'), { role: 'admin' }))
  })

  it('anyone reads settings, only admins write', async () => {
    await assertSucceeds(getDoc(doc(anon('v1'), 'settings/public')))
    await assertFails(setDoc(doc(staff('org1'), 'settings/public'), { socials: {} }))
    await assertSucceeds(setDoc(doc(staff('admin1'), 'settings/public'), { socials: {} }))
  })
})

describe('promo codes', () => {
  const promo = (over = {}) => ({ type: 'percent', value: 20, maxUses: 3, uses: 0, active: true, tierIds: [], ...over })

  function promoBatch(db, uid, { code = 'SAVE20', discount, qty = 1, bookingId = 'p1', uses = 0, over } = {}) {
    const batch = writeBatch(db)
    const codes = Array.from({ length: qty }, (_, i) => `UV-${bookingId}${i}`)
    batch.set(doc(db, 'bookings', bookingId), bookingData(uid, { eventId: 'e3', unitPrice: 0, quantity: qty, ticketCodes: codes, tickets: codes.map((c) => ({ code: c, checkedIn: false })), promoCode: code, discount, ...over }))
    batch.update(doc(db, 'events', 'e3'), { 'tiers.t1.bookedSlots': qty, txn: bookingId })
    batch.set(doc(db, 'events', 'e3', 'holders', uid), { count: qty, txn: bookingId })
    batch.update(doc(db, 'events', 'e3', 'promos', code), { uses: uses + qty, txn: bookingId })
    return batch.commit()
  }

  beforeEach(async () => {
    // e3 tier at KES 500 so discounts are non-zero.
    await seed(async (db) => {
      await updateDoc(doc(db, 'events/e3'), { 'tiers.t1.price': 500 })
      await setDoc(doc(db, 'events/e3/promos/SAVE20'), promo())
      await setDoc(doc(db, 'events/e3/promos/FREE'), promo({ type: 'free', value: 0, maxUses: 1 }))
      await setDoc(doc(db, 'events/e3/promos/OFF'), promo({ active: false }))
    })
  })

  const withPrice = (o) => ({ ...o, over: { unitPrice: 500, ...(o.over || {}) } })

  it('a valid code gives exactly its discount', async () => {
    await assertSucceeds(promoBatch(anon('v1'), 'v1', withPrice({ qty: 2, discount: 200 })))
  })

  it('rejects a bigger discount than the code gives', async () => {
    await assertFails(promoBatch(anon('v1'), 'v1', withPrice({ qty: 2, discount: 1000 })))
  })

  it('rejects a discount without a code', async () => {
    await assertFails(bookBatch(anon('v1'), 'v1', { eventId: 'e3', over: { unitPrice: 500, discount: 500 } }))
  })

  it('free codes make the booking free; uses are capped', async () => {
    await assertSucceeds(promoBatch(anon('v1'), 'v1', withPrice({ code: 'FREE', discount: 500 })))
    await assertFails(promoBatch(anon('v2'), 'v2', withPrice({ code: 'FREE', discount: 500, bookingId: 'p2', uses: 1 })))
  })

  it('inactive codes cannot be used', async () => {
    await assertFails(promoBatch(anon('v1'), 'v1', withPrice({ code: 'OFF', discount: 100 })))
  })

  it('the code use counter cannot be bumped without a booking', async () => {
    await assertFails(updateDoc(doc(anon('v1'), 'events/e3/promos/SAVE20'), { uses: 0, txn: 'nothing' }))
  })

  it('visitors can check a code they know but cannot list codes', async () => {
    await assertSucceeds(getDoc(doc(anon('v1'), 'events/e3/promos/SAVE20')))
    await assertFails(getDocs(collection(anon('v1'), 'events/e3/promos')))
    await assertSucceeds(getDocs(collection(staff('org1'), 'events/e3/promos')))
  })

  it('only the event owner creates codes', async () => {
    await assertSucceeds(setDoc(doc(staff('org1'), 'events/e3/promos/NEW'), promo()))
    await assertFails(setDoc(doc(staff('org2'), 'events/e3/promos/NEW2'), promo()))
    await assertFails(setDoc(doc(anon('v1'), 'events/e3/promos/NEW3'), promo()))
  })
})

describe('clubs', () => {
  it('organizers edit only their own public profile', async () => {
    await assertSucceeds(setDoc(doc(staff('org1'), 'clubs/org1'), { name: 'Computing Society', bio: '' }))
    await assertFails(setDoc(doc(staff('org1'), 'clubs/org2'), { name: 'Not mine' }))
    await assertFails(setDoc(doc(anon('v1'), 'clubs/v1'), { name: 'Fake club' }))
    await assertSucceeds(getDoc(doc(anon('v1'), 'clubs/org1')))
  })
})
