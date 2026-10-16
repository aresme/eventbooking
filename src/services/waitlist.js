import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logActivity } from './logs'

const waitlistsCol = collection(db, 'waitlists')

export class AlreadyWaitlistedError extends Error {}

export async function joinWaitlist({ event, tierId, uid, details }) {
  const ref = doc(waitlistsCol, `${event.id}_${tierId}_${uid}`)
  if ((await getDoc(ref)).exists()) throw new AlreadyWaitlistedError("You're already on the waitlist for this ticket.")
  await setDoc(ref, {
    eventId: event.id,
    tierId,
    userId: uid,
    ownerId: event.ownerId,
    eventTitle: event.title,
    tierName: event.tiers[tierId]?.name || '',
    fullName: details.fullName,
    phone: details.phone,
    email: details.email || '',
    regNumber: details.regNumber || '',
    school: details.school || '',
    joinedAt: serverTimestamp(),
  })
}

export function subscribeManagedWaitlist({ uid, role }, onData, onError) {
  const base = role === 'admin' ? [] : [where('ownerId', '==', uid)]
  return onSnapshot(
    query(waitlistsCol, ...base, orderBy('joinedAt', 'asc')),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export function subscribeMyWaitlist(uid, onData, onError) {
  return onSnapshot(
    query(waitlistsCol, where('userId', '==', uid)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export async function removeWaitlistEntry(entry, user) {
  await deleteDoc(doc(waitlistsCol, entry.id))
  if (user) await logActivity(user, entry.ownerId, 'waitlist_removed', { eventId: entry.eventId, attendeeName: entry.fullName })
}
