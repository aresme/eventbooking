import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const publicRef = doc(db, 'settings', 'public')

export const DEFAULT_SETTINGS = {
  socials: { facebook: '', instagram: '', twitter: '', tiktok: '' },
  cloudinary: { cloudName: '', uploadPreset: '' },
  contactEmail: '',
}

export function subscribeSettings(onData, onError) {
  return onSnapshot(
    publicRef,
    (snap) => {
      const data = snap.data() || {}
      onData({
        ...DEFAULT_SETTINGS,
        ...data,
        socials: { ...DEFAULT_SETTINGS.socials, ...data.socials },
        cloudinary: { ...DEFAULT_SETTINGS.cloudinary, ...data.cloudinary },
      })
    },
    onError,
  )
}

export async function saveSettings(partial) {
  await setDoc(publicRef, partial, { merge: true })
}

export async function uploadToCloudinary(file, { cloudName, uploadPreset }) {
  if (!cloudName || !uploadPreset) throw new Error('Set up Cloudinary in Settings first.')
  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message || 'Image upload failed')
  return json.secure_url
}

export async function searchUnsplash(q) {
  const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
  if (!key) throw new Error('Add VITE_UNSPLASH_ACCESS_KEY to .env to search Unsplash.')
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`,
    { headers: { Authorization: `Client-ID ${key}` } },
  )
  if (!res.ok) throw new Error('Unsplash search failed')
  const json = await res.json()
  return json.results.map((r) => ({ id: r.id, thumb: r.urls.small, full: r.urls.regular, alt: r.alt_description, author: r.user.name }))
}

export async function generateDescription({ title, type, venue, date }) {
  const key = import.meta.env.VITE_GEMINI_API_KEY
  if (!key) throw new Error('Add VITE_GEMINI_API_KEY to .env to use AI descriptions.')
  const prompt = `Write an engaging 2-paragraph description (max 120 words) for a university ${type === 'school' ? 'school' : 'campus'} event called "${title}"${venue ? ` at ${venue}` : ''}${date ? ` on ${date}` : ''}. Friendly, energetic tone for students. Plain text only, no markdown, no hashtags.`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(json.error?.message || 'AI could not generate a description')
  return text.trim()
}
