// Fill the local emulators with demo data. Run `npm run emulators` first, then `npm run seed`.
// Creates admin@univibe.test / organizer@univibe.test (password: password123).
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, Timestamp } from 'firebase/firestore'

const PROJECT = 'demo-univibe'
const AUTH = 'http://127.0.0.1:9099'

async function createUser(email, displayName) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', displayName, returnSecureToken: true }),
  })
  const json = await res.json()
  if (json.localId) return json.localId
  // Already exists: sign in to get the uid.
  const login = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
  })
  return (await login.json()).localId
}

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const img = (id) => `https://images.unsplash.com/photo-${id}?w=1200&h=750&fit=crop&auto=format`

const env = await initializeTestEnvironment({
  projectId: PROJECT,
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
})
await env.clearFirestore()

const adminId = await createUser('admin@univibe.test', 'Grace Admin')
const orgId = await createUser('organizer@univibe.test', 'Brian Otieno')
const pendingId = await createUser('newclub@univibe.test', 'Aisha Mohamed')

const events = [
  { id: 'freshers', title: 'Freshers’ Night 2026', type: 'normal', date: day(3), time: '19:00', venue: 'Main Grounds', featured: true, image: img('1514525253161-7a46d19cd819'), tiers: { reg: ['Regular', 300, 400, 287], vip: ['VIP', 1000, 50, 50] }, desc: 'Kick off the semester with the biggest party on campus. Live DJs, food trucks and a surprise headline act.\n\nBring your student ID.' },
  { id: 'hackathon', title: 'Build for Kenya Hackathon', type: 'school', school: 'School of Computing & Informatics', date: day(6), time: '08:30', venue: 'Computing Labs, Block C', image: img('1540575467063-178a50c2df87'), tiers: { team: ['Participant', 0, 120, 64] }, desc: '24 hours to build something that matters. Mentors from local startups, prizes worth KES 150,000 and free meals all night.', owner: 'org', multi: 3 },
  { id: 'gala', title: 'Engineering Gala Dinner', type: 'school', school: 'School of Engineering', date: day(12), time: '18:30', venue: 'Senate Hall', image: img('1511795409834-ef04bbd61622'), tiers: { single: ['Single', 1500, 150, 98], couple: ['Couple', 2500, 40, 40] }, desc: 'An evening of awards, dinner and dancing to celebrate this year’s engineering graduates.' },
  { id: 'summit', title: 'Young Entrepreneurs Summit', type: 'normal', date: day(9), time: '10:00', venue: 'Business School Auditorium', image: img('1551818255-e6e10975bc17'), tiers: { gen: ['General', 0, 300, 41] }, desc: 'Founders, investors and alumni share what they wish they knew at 20. Networking lunch included.', owner: 'org' },
  { id: 'football', title: 'Inter-School Football Final', type: 'normal', date: day(1), time: '15:00', venue: 'University Stadium', image: img('1508098682722-e99c43a406b2'), tiers: { stand: ['Stand', 100, 800, 512] }, desc: 'Computing vs Engineering. Come support your school!' },
  { id: 'poetry', title: 'Open Mic & Poetry Night', type: 'normal', date: day(16), time: '18:00', venue: 'Student Centre Café', image: img('1475721027785-f74eccf877e2'), tiers: { gen: ['Entry', 0, 80, 12] }, desc: 'Spoken word, acoustic sets and good vibes. Sign up to perform at the door.', owner: 'org' },
  { id: 'career', title: 'Tech Careers Fair', type: 'normal', date: day(21), time: '09:00', venue: 'Main Hall', status: 'pending', image: img('1556761175-5973dc0f32e7'), tiers: { gen: ['Visitor', 0, 500, 0] }, desc: '30+ employers hiring interns and graduates.', owner: 'org' },
]

const first = ['Wanjiku', 'Otieno', 'Achieng', 'Kamau', 'Mwangi', 'Njeri', 'Kiprop', 'Chebet', 'Omondi', 'Wambui', 'Mutua', 'Akinyi']
const last = ['Kariuki', 'Odhiambo', 'Kimani', 'Wekesa', 'Ndungu', 'Korir', 'Maina', 'Owino']

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'users', adminId), { role: 'admin', email: 'admin@univibe.test', displayName: 'Grace Admin', org: 'UniVibe' })
  await setDoc(doc(db, 'users', orgId), { role: 'organizer', email: 'organizer@univibe.test', displayName: 'Brian Otieno', org: 'Computing Society' })
  await setDoc(doc(db, 'users', pendingId), { role: 'pending', email: 'newclub@univibe.test', displayName: 'Aisha Mohamed', org: 'Drama Club', createdAt: Timestamp.now() })
  await setDoc(doc(db, 'settings/public'), { socials: { instagram: 'https://instagram.com/univibe', twitter: 'https://x.com/univibe' } })

  let n = 0
  for (const e of events) {
    const ownerId = e.owner === 'org' ? orgId : adminId
    const tiers = {}
    Object.entries(e.tiers).forEach(([id, [name, price, totalSlots, bookedSlots]], i) => (tiers[id] = { name, price, totalSlots, bookedSlots, order: i }))
    await setDoc(doc(db, 'events', e.id), {
      title: e.title, description: e.desc, type: e.type, school: e.school || '', date: e.date, time: e.time, venue: e.venue, mapQuery: '',
      image: e.image, status: e.status || 'published', featured: Boolean(e.featured), ownerId, ownerName: e.owner === 'org' ? 'Computing Society' : 'UniVibe',
      allowMultiple: Boolean(e.multi), maxTickets: e.multi || 1, tiers, createdAt: Timestamp.now(),
    })

    // A handful of sample bookings per event (counters above are illustrative totals).
    for (let i = 0; i < 6 && Object.values(tiers)[0].bookedSlots > 0; i++) {
      const [tierId, tier] = Object.entries(tiers)[i % Object.keys(tiers).length]
      const code = `UV-${(++n).toString(36).toUpperCase().padStart(6, 'X')}`
      const bookedAt = Timestamp.fromDate(new Date(Date.now() - Math.random() * 12 * 86400000))
      await setDoc(doc(db, 'bookings', `${e.id}-${i}`), {
        eventId: e.id, tierId, userId: `seed-${n}`, ownerId, eventTitle: e.title, tierName: tier.name, unitPrice: tier.price,
        fullName: `${first[n % first.length]} ${last[n % last.length]}`, phone: `07${String(10000000 + n * 7919).slice(0, 8)}`,
        email: '', regNumber: e.type === 'school' ? `SCT211-${String(n).padStart(4, '0')}/2024` : '', school: e.school || '',
        quantity: 1, tickets: [{ code, checkedIn: i === 0 }], ticketCodes: [code], status: i === 5 ? 'cancelled' : 'confirmed', source: 'web', bookedAt,
      })
    }
  }

  await setDoc(doc(db, 'waitlists', `freshers_vip_seed-w1`), {
    eventId: 'freshers', tierId: 'vip', userId: 'seed-w1', ownerId: adminId, eventTitle: events[0].title, tierName: 'VIP',
    fullName: 'Kevin Mutai', phone: '0722000111', email: 'kevin@example.com', regNumber: '', school: '', joinedAt: Timestamp.now(),
  })
})

await env.cleanup()
console.log(`Seeded ${events.length} events.\n  admin@univibe.test / password123\n  organizer@univibe.test / password123`)
