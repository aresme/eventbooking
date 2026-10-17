import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { logActivity } from './logs'

const updatesCol = (eventId) => collection(db, 'events', eventId, 'updates')

export function subscribeUpdates(eventId, onData, onError) {
  return onSnapshot(
    query(updatesCol(eventId), orderBy('createdAt', 'desc'), limit(20)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export async function postUpdate(event, message, user) {
  await addDoc(updatesCol(event.id), {
    message: message.trim(),
    authorName: user.profile?.org || user.profile?.displayName || '',
    createdAt: serverTimestamp(),
  })
  await logActivity(user, event.ownerId, 'event_update_posted', { eventId: event.id, eventTitle: event.title })
}

export function deleteUpdate(eventId, updateId) {
  return deleteDoc(doc(updatesCol(eventId), updateId))
}
