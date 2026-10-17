// Booking ids made on this device, so "My tickets" can still show them after the visitor signs
// in with Google (which may switch to a different account) or if a query misses them.
const KEY = 'uv_device_bookings'

export function deviceBookingIds() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function rememberBooking(id) {
  try {
    const ids = deviceBookingIds()
    if (!ids.includes(id)) localStorage.setItem(KEY, JSON.stringify([id, ...ids].slice(0, 100)))
  } catch {
    /* private mode */
  }
}
