import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// people/{uid}: saved events and followed clubs for the current visitor (anonymous or Google).
const personRef = (uid) => doc(db, 'people', uid)

export function subscribePerson(uid, onData, onError) {
  return onSnapshot(personRef(uid), (snap) => onData({ saved: [], following: [], ...snap.data() }), onError)
}

export function setSaved(uid, eventId, on) {
  return setDoc(personRef(uid), { saved: on ? arrayUnion(eventId) : arrayRemove(eventId), updatedAt: serverTimestamp() }, { merge: true })
}

export function setFollowing(uid, clubId, on) {
  return setDoc(personRef(uid), { following: on ? arrayUnion(clubId) : arrayRemove(clubId), updatedAt: serverTimestamp() }, { merge: true })
}
