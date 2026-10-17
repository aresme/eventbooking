import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function subscribeClub(clubId, onData, onError) {
  return onSnapshot(doc(db, 'clubs', clubId), (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError)
}

export function subscribeClubEvents(clubId, onData, onError) {
  return onSnapshot(
    query(collection(db, 'events'), where('status', '==', 'published'), where('ownerId', '==', clubId)),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

export class ClubError extends Error {}

export function saveClub(uid, { name, bio, logo, website, instagram }) {
  for (const [label, v] of [['Logo URL', logo], ['Website', website], ['Instagram', instagram]]) {
    if (v.trim() && !/^https:\/\/\S+$/i.test(v.trim())) throw new ClubError(`${label} must be a full link starting with https://`)
  }
  return setDoc(
    doc(db, 'clubs', uid),
    { name: name.trim().slice(0, 80), bio: bio.trim().slice(0, 1000), logo: logo.trim(), website: website.trim(), instagram: instagram.trim(), updatedAt: serverTimestamp() },
    { merge: true },
  )
}
