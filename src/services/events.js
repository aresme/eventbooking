import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logActivity } from './logs'

const eventsCol = collection(db, 'events')

const withId = (snap) => ({ id: snap.id, ...snap.data() })
// v1 events (tiers stored as a list, no status) are skipped until tools/migrate_v2.py converts them.
const isV2 = (e) => e.status && e.tiers && !Array.isArray(e.tiers)

export function subscribePublishedEvents(onData, onError) {
  return onSnapshot(
    query(eventsCol, where('status', '==', 'published')),
    (snap) => onData(snap.docs.map(withId)),
    onError,
  )
}

export function subscribeEvent(eventId, onData, onError) {
  return onSnapshot(
    doc(eventsCol, eventId),
    (snap) => onData(snap.exists() ? withId(snap) : null),
    onError,
  )
}

/** Admins see every event; organizers only their own. */
export function subscribeManagedEvents({ uid, role }, onData, onError) {
  const q = role === 'admin' ? eventsCol : query(eventsCol, where('ownerId', '==', uid))
  return onSnapshot(q, (snap) => onData(snap.docs.map(withId).filter(isV2)), onError)
}

/**
 * Create or update an event. `tiers` is an array from the form; it is stored as a map keyed by
 * tier id so booking rules can address a single tier. Booked counts are always kept from the
 * stored event, never from the form.
 */
export async function saveEvent({ id, values, tiers, existing, user }) {
  const isAdmin = user.role === 'admin'
  const tierMap = {}
  tiers.forEach((t, i) => {
    const booked = existing?.tiers?.[t.id]?.bookedSlots || 0
    tierMap[t.id] = {
      name: t.name.trim(),
      price: Math.max(0, Number(t.price) || 0),
      totalSlots: Math.max(booked, Number(t.totalSlots) || 1),
      bookedSlots: booked,
      order: i,
    }
  })

  const data = {
    title: values.title.trim(),
    description: values.description.trim(),
    type: values.type,
    school: values.type === 'school' ? values.school : '',
    date: values.date,
    time: values.time,
    venue: values.venue.trim(),
    mapQuery: values.mapQuery?.trim() || '',
    image: values.image || '',
    allowMultiple: Boolean(values.allowMultiple),
    maxTickets: values.allowMultiple ? Math.min(20, Math.max(1, Number(values.maxTickets) || 5)) : 1,
    tiers: tierMap,
    updatedAt: serverTimestamp(),
  }

  if (id) {
    await updateDoc(doc(eventsCol, id), data)
    await logActivity(user, existing.ownerId, 'event_updated', { eventId: id, eventTitle: data.title })
    return id
  }

  const ref = doc(eventsCol)
  await setDoc(ref, {
    ...data,
    ownerId: user.uid,
    ownerName: user.profile?.org || user.profile?.displayName || user.email || '',
    status: isAdmin ? 'published' : 'pending',
    featured: false,
    createdAt: serverTimestamp(),
  })
  await logActivity(user, user.uid, 'event_created', { eventId: ref.id, eventTitle: data.title })
  return ref.id
}

export async function setEventStatus(event, status, user) {
  await updateDoc(doc(eventsCol, event.id), { status, updatedAt: serverTimestamp() })
  await logActivity(user, event.ownerId, `event_${status}`, { eventId: event.id, eventTitle: event.title })
}

export async function setEventFeatured(event, featured) {
  await updateDoc(doc(eventsCol, event.id), { featured })
}

export async function deleteEvent(event, user) {
  await deleteDoc(doc(eventsCol, event.id))
  await logActivity(user, event.ownerId, 'event_deleted', { eventId: event.id, eventTitle: event.title })
}
