function stamp(date, time) {
  return `${date.replace(/-/g, '')}T${(time || '09:00').replace(':', '')}00`
}

function endStamp(event) {
  const start = new Date(`${event.date}T${event.time || '09:00'}`)
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`
}

export function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.date, event.time)}/${endStamp(event)}`,
    details: `${(event.description || '').slice(0, 500)}\n\n${window.location.origin}/events/${event.id}`,
    location: event.venue || '',
    ctz: 'Africa/Nairobi',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export function outlookCalendarUrl(event) {
  const start = new Date(`${event.date}T${event.time || '09:00'}`)
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    location: event.venue || '',
    body: (event.description || '').slice(0, 500),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`
}

export function downloadIcs(event) {
  const esc = (s) => String(s || '').replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UniVibe//Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@univibe`,
    `DTSTART;TZID=Africa/Nairobi:${stamp(event.date, event.time)}`,
    `DTEND;TZID=Africa/Nairobi:${endStamp(event)}`,
    `SUMMARY:${esc(event.title)}`,
    `LOCATION:${esc(event.venue)}`,
    `DESCRIPTION:${esc(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${event.title.replace(/[^\w]+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}
