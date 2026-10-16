import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase'

const usersCol = collection(db, 'users')

export function subscribeProfile(uid, onData, onError) {
  return onSnapshot(doc(usersCol, uid), (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError)
}

export function subscribeUsers(onData, onError) {
  return onSnapshot(usersCol, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export async function staffSignIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

/** Organizer sign-up: account starts as 'pending' until an admin approves it. */
export async function organizerSignUp({ email, password, displayName, org }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName })
  await setDoc(doc(usersCol, cred.user.uid), {
    role: 'pending',
    email,
    displayName,
    org,
    createdAt: serverTimestamp(),
  })
  return cred.user
}

export async function setUserRole(userId, role) {
  await updateDoc(doc(usersCol, userId), { role })
}

export async function removeUser(userId) {
  await deleteDoc(doc(usersCol, userId))
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword))
  await updatePassword(user, newPassword)
}

export function staffSignOut() {
  return signOut(auth)
}
