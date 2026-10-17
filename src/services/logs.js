import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const logsCol = collection(db, 'activityLogs')

export async function logActivity(user, ownerId, action, details = {}) {
  try {
    await addDoc(logsCol, {
      action,
      ...details,
      ownerId: ownerId || user.uid,
      actorId: user.uid,
      actorName: user.profile?.displayName || user.email || '',
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    // Logging must never block the action itself.
    console.warn('Activity log failed', err)
  }
}

export function subscribeLogs({ uid, role }, onData, onError) {
  const base = role === 'admin' ? [] : [where('ownerId', '==', uid)]
  return onSnapshot(
    query(logsCol, ...base, orderBy('createdAt', 'desc'), limit(200)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}
