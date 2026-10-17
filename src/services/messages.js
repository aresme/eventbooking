import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const messagesCol = collection(db, 'messages')

export function sendMessage({ name, contact, topic, message, eventId }, uid) {
  return addDoc(messagesCol, {
    name: name.trim(),
    contact: contact.trim(),
    topic,
    message: message.trim(),
    eventId: eventId || '',
    userId: uid,
    status: 'open',
    createdAt: serverTimestamp(),
  })
}

export function subscribeMessages(onData, onError) {
  return onSnapshot(query(messagesCol, orderBy('createdAt', 'desc'), limit(200)), (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export function setMessageStatus(id, status) {
  return updateDoc(doc(messagesCol, id), { status })
}

export function deleteMessage(id) {
  return deleteDoc(doc(messagesCol, id))
}
