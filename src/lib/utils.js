import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const SCHOOLS = [
  'School of Computing & Informatics',
  'School of Engineering',
  'School of Business',
  'School of Medicine',
  'School of Law',
  'School of Education',
  'School of Arts & Social Sciences',
  'School of Science',
  'School of Agriculture',
  'School of Architecture',
]

// ---------- phone ----------
const KE_PHONE = /^(\+254|254|0)?([17]\d{8})$/

export function normalizePhone(raw) {
  const m = String(raw || '').replace(/[\s-]/g, '').match(KE_PHONE)
  return m ? '0' + m[2] : null
}

// ---------- ids ----------
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function ticketCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'UV-' + Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export function shortId() {
  return crypto.randomUUID().slice(0, 8)
}

// ---------- dates & money ----------
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

export function eventStart(event) {
  return new Date(`${event.date}T${event.time || '00:00'}`)
}

export function isEnded(event) {
  return new Date(`${event.date}T23:59:59`) < new Date()
}

export function formatDate(dateStr, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!dateStr) return ''
  return new Date(`${dateStr}T00:00`).toLocaleDateString('en-KE', opts)
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}

export function formatPrice(amount) {
  return amount > 0 ? `KES ${Number(amount).toLocaleString('en-KE')}` : 'Free'
}

export function timeAgo(value) {
  const d = toDate(value)
  if (!d) return ''
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const units = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
  ]
  let label = ''
  for (const [size, name] of units) {
    if (s >= size) {
      const n = Math.floor(s / size)
      label = `${n} ${name}${n > 1 ? 's' : ''} ago`
    }
  }
  return label
}

// ---------- event helpers ----------
export function tierList(event) {
  return Object.entries(event?.tiers || {})
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

export function eventStats(event) {
  const tiers = tierList(event)
  const total = tiers.reduce((s, t) => s + (t.totalSlots || 0), 0)
  const booked = tiers.reduce((s, t) => s + (t.bookedSlots || 0), 0)
  const prices = tiers.map((t) => t.price || 0)
  return {
    total,
    booked,
    left: Math.max(0, total - booked),
    pct: total ? Math.min(100, Math.round((booked / total) * 100)) : 0,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    soldOut: total > 0 && booked >= total,
  }
}

export function eventImage(event, w = 800, h = 500) {
  if (event?.image?.startsWith('http')) return event.image
  return `https://picsum.photos/seed/${encodeURIComponent(event?.id || 'univibe')}/${w}/${h}`
}

export function downloadCsv(filename, rows) {
  // Prefix cells that Excel/Sheets would treat as formulas (=, +, -, @) so attendee names can't run code.
  const escape = (v) => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---------- categories ----------
export const CATEGORIES = [
  { value: 'music', label: 'Music & Parties', emoji: '🎶' },
  { value: 'tech', label: 'Tech', emoji: '💻' },
  { value: 'sports', label: 'Sports', emoji: '⚽' },
  { value: 'career', label: 'Career', emoji: '💼' },
  { value: 'arts', label: 'Arts & Culture', emoji: '🎭' },
  { value: 'academic', label: 'Academic', emoji: '📚' },
  { value: 'faith', label: 'Faith', emoji: '🙏' },
  { value: 'wellness', label: 'Wellness', emoji: '🧘' },
  { value: 'other', label: 'Other', emoji: '✨' },
]

export function categoryOf(event) {
  return CATEGORIES.find((c) => c.value === event?.category) || null
}

// ---------- promo codes ----------
/** Discount in KES for `quantity` tickets at `unitPrice`. Must match promoDiscountOk in firestore.rules. */
export function promoDiscount(promo, unitPrice, quantity) {
  const gross = unitPrice * quantity
  if (!promo) return 0
  if (promo.type === 'free') return gross
  if (promo.type === 'percent') return Math.floor((gross * promo.value) / 100)
  return Math.min(gross, promo.value * quantity)
}

export function promoLabel(promo) {
  if (promo.type === 'free') return 'Free tickets'
  if (promo.type === 'percent') return `${promo.value}% off`
  return `${formatPrice(promo.value)} off per ticket`
}

export function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')
}

// ---------- security ----------
/** Only https:// links may be rendered from user-entered data (blocks javascript: and data: URLs). */
export function safeUrl(url) {
  const u = String(url || '').trim()
  return /^https:\/\/[^\s"<>]+$/i.test(u) ? u : ''
}
