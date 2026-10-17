// Penetration-style checks: each test attempts an abuse; the comment says what it tries.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

let env
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
const staff = (uid) => env.authenticatedContext(uid, { email: `${uid}@t.com`, firebase: { sign_in_provider: 'password' } }).firestore()
const tiers = { t1: { name: 'General', price: 100, totalSlots: 5, bookedSlots: 0, order: 0 } }
const event = (o = {}) => ({ title: 'Real Event', type: 'normal', date: '2099-01-01', time: '18:00', venue: 'Hall', status: 'published', featured: false, ownerId: 'org1', allowMultiple: false, maxTickets: 1, tiers, ...o })

function book(db, uid, over = {}, { eventId = 'e1', id = 'b1' } = {}) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'bookings', id), { eventId, tierId: 't1', userId: uid, ownerId: 'org1', eventTitle: 'Real Event', tierName: 'General', unitPrice: 100, fullName: 'Jane Doe', phone: '0712345678', email: '', regNumber: '', school: '', quantity: 1, tickets: [{ code: 'UV-AAAAAA', checkedIn: false }], ticketCodes: ['UV-AAAAAA'], status: 'confirmed', source: 'web', bookedAt: serverTimestamp(), ...over })
  batch.update(doc(db, 'events', eventId), { 'tiers.t1.bookedSlots': 1, txn: id })
  batch.set(doc(db, 'events', eventId, 'holders', uid), { count: 1, txn: id })
  return batch.commit()
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-univibe-rules', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
})
afterAll(() => env?.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/org1'), { role: 'organizer' })
    await setDoc(doc(db, 'users/door1'), { role: 'door', ownerId: 'org1' })
    await setDoc(doc(db, 'events/e1'), event())
    await setDoc(doc(db, 'events/old'), event({ date: '2020-01-01' }))
    await setDoc(doc(db, 'events/hidden'), event({ status: 'hidden' }))
  })
})

describe('attacks', () => {
  it('A1 spoof the event title / tier name stored on my ticket', () => assertFails(book(anon('v1'), 'v1', { eventTitle: 'VIP Backstage Pass', tierName: 'VIP' })))
  it('A2 store a 500 KB string in a booking field', () => assertFails(book(anon('v1'), 'v1', { regNumber: 'x'.repeat(500000) })))
  it('A3 invalid email stored on a booking (email abuse)', () => assertFails(book(anon('v1'), 'v1', { email: 'not-an-email' })))
  it('A4 book an event that already ended', () => assertFails(book(anon('v1'), 'v1', {}, { eventId: 'old' })))
  it('A5 join waitlist of a hidden event', () => assertFails(setDoc(doc(anon('v1'), 'waitlists/hidden_t1_v1'), { eventId: 'hidden', tierId: 't1', userId: 'v1', ownerId: 'org1', fullName: 'Jane Doe', phone: '0712345678', joinedAt: serverTimestamp() })))
  it('A6 waitlist entry with junk extra fields', () => assertFails(setDoc(doc(anon('v1'), 'waitlists/e1_t1_v1'), { eventId: 'e1', tierId: 't1', userId: 'v1', ownerId: 'org1', fullName: 'Jane Doe', phone: '0712345678', joinedAt: serverTimestamp(), junk: 'x'.repeat(100000) })))
  it('A7 club website with a javascript: link (XSS)', () => assertFails(setDoc(doc(staff('org1'), 'clubs/org1'), { name: 'Club', website: 'javascript:alert(1)' })))
  it('A8 door staff rewrites ticket codes', async () => {
    await book(anon('v1'), 'v1')
    await assertFails(updateDoc(doc(staff('door1'), 'bookings/b1'), { tickets: [{ code: 'UV-ZZZZZZ', checkedIn: true }] }))
  })
  it('A9 door staff un-checks a scanned ticket', async () => {
    await book(anon('v1'), 'v1')
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'bookings/b1'), { tickets: [{ code: 'UV-AAAAAA', checkedIn: true }] }))
    await assertFails(updateDoc(doc(staff('door1'), 'bookings/b1'), { tickets: [{ code: 'UV-AAAAAA', checkedIn: false }] }))
  })
  it('A10 read updates of a hidden event', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'events/hidden/updates/u1'), { message: 'secret' }))
    await assertFails(getDoc(doc(anon('v1'), 'events/hidden/updates/u1')))
  })
  it('A11 contact message with oversized topic', () => assertFails(addDoc(collection(anon('v1'), 'messages'), { name: 'Jo', contact: 'jo@x.com', topic: 'x'.repeat(5000), message: 'hello there', eventId: '', userId: 'v1', status: 'open', createdAt: serverTimestamp() })))
  it('A12 organizer posts an event pretending to be another host', () => assertFails(setDoc(doc(staff('org1'), 'events/fake'), event({ status: 'pending', ownerName: 'UniVibe Official' }))))
})
