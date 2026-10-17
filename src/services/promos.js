import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { normalizeCode } from '@/lib/utils'

const promosCol = (eventId) => collection(db, 'events', eventId, 'promos')

export class PromoError extends Error {}

/** Look up a code for an event; throws PromoError with a friendly message when it can't be used. */
export async function checkPromo(eventId, rawCode, tierId, quantity) {
  const code = normalizeCode(rawCode)
  if (!code) throw new PromoError('Enter a code')
  const snap = await getDoc(doc(promosCol(eventId), code))
  if (!snap.exists()) throw new PromoError('That code isn’t valid for this event')
  const promo = { code, ...snap.data() }
  if (!promo.active) throw new PromoError('This code is no longer active')
  if (promo.tierIds?.length && !promo.tierIds.includes(tierId)) throw new PromoError('This code doesn’t apply to this ticket type')
  const left = promo.maxUses - promo.uses
  if (left < quantity) throw new PromoError(left > 0 ? `This code has only ${left} use${left > 1 ? 's' : ''} left` : 'This code has been fully used')
  return promo
}

export function subscribePromos(eventId, onData, onError) {
  return onSnapshot(promosCol(eventId), (snap) => onData(snap.docs.map((d) => ({ code: d.id, ...d.data() }))), onError)
}

export async function createPromo(eventId, { code, type, value, maxUses, tierIds }) {
  const id = normalizeCode(code)
  const ref = doc(promosCol(eventId), id)
  if ((await getDoc(ref)).exists()) throw new PromoError(`${id} already exists for this event`)
  await setDoc(ref, {
    type,
    value: type === 'free' ? 0 : Math.max(0, Math.round(Number(value) || 0)),
    maxUses: Math.max(1, Math.round(Number(maxUses) || 1)),
    uses: 0,
    active: true,
    tierIds: tierIds || [],
  })
  return id
}

export function setPromoActive(eventId, code, active) {
  return updateDoc(doc(promosCol(eventId), code), { active })
}

export function deletePromo(eventId, code) {
  return deleteDoc(doc(promosCol(eventId), code))
}
