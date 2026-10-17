import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Keyboard, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { checkInTicket, findBookingByCode } from '@/services/bookings'
import { cn, isEnded, timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { Card, CardHeader, Progress } from '@/components/ui/misc'
import { useDashboard } from './DashboardLayout'

const RESULT = {
  ok: { icon: CheckCircle2, tone: 'border-success/40 bg-success-soft text-success', title: 'Checked in' },
  already: { icon: AlertTriangle, tone: 'border-warning/40 bg-warning-soft text-warning', title: 'Already checked in' },
  wrongEvent: { icon: AlertTriangle, tone: 'border-warning/40 bg-warning-soft text-warning', title: 'Ticket is for another event' },
  cancelled: { icon: XCircle, tone: 'border-danger/40 bg-danger-soft text-danger', title: 'Booking was cancelled' },
  invalid: { icon: XCircle, tone: 'border-danger/40 bg-danger-soft text-danger', title: 'Ticket not found' },
}

export default function Scanner() {
  const { user } = useAuth()
  const { events, bookings, eventsById, scope } = useDashboard()
  const today = useMemo(() => events.filter((e) => !isEnded(e)).sort((a, b) => a.date.localeCompare(b.date)), [events])
  const [eventId, setEventId] = useState('')
  const [camera, setCamera] = useState(false)
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const busy = useRef(false)
  const lastCode = useRef({ code: '', at: 0 })

  useEffect(() => {
    if (!eventId && today[0]) setEventId(today[0].id)
  }, [today, eventId])

  const progress = useMemo(() => {
    const list = bookings.filter((b) => b.eventId === eventId && b.status === 'confirmed')
    const total = list.reduce((s, b) => s + b.quantity, 0)
    const inside = list.reduce((s, b) => s + b.tickets.filter((t) => t.checkedIn).length, 0)
    return { total, inside, pct: total ? Math.round((inside / total) * 100) : 0 }
  }, [bookings, eventId])

  async function verify(raw) {
    const c = raw.trim().toUpperCase()
    if (!c || busy.current) return
    // The camera reports the same code many times a second; ignore repeats for 3s.
    if (lastCode.current.code === c && Date.now() - lastCode.current.at < 3000) return
    lastCode.current = { code: c, at: Date.now() }
    busy.current = true
    try {
      const booking = await findBookingByCode(c, scope)
      let r
      if (!booking) r = { kind: 'invalid', code: c }
      else if (eventId && booking.eventId !== eventId) r = { kind: 'wrongEvent', code: c, booking }
      else {
        const { result: res, booking: b } = await checkInTicket(booking.id, c, user)
        r = { kind: res, code: c, booking: b }
      }
      setResult(r)
      setHistory((h) => [{ ...r, at: new Date() }, ...h].slice(0, 15))
      navigator.vibrate?.(r.kind === 'ok' ? 80 : [60, 60, 60])
    } catch (err) {
      console.error(err)
      setResult({ kind: 'invalid', code: c, error: err.message })
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1.5">
              <span className="text-sm font-semibold">Checking in for</span>
              <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">Any event</option>
                {today.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </Select>
            </label>
            <Button variant={camera ? 'outline' : 'default'} onClick={() => setCamera((c) => !c)}>
              {camera ? <><CameraOff /> Stop camera</> : <><Camera /> Start camera</>}
            </Button>
          </div>
          {eventId && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="font-semibold">{progress.inside} / {progress.total} inside</span>
                <span className="text-muted-foreground">{progress.pct}%</span>
              </div>
              <Progress value={progress.pct} className="h-2 [&>div]:bg-success" />
            </div>
          )}
        </Card>

        {camera && <CameraView onCode={verify} />}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            lastCode.current = { code: '', at: 0 }
            verify(code)
            setCode('')
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Keyboard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Type a ticket code, e.g. UV-AB12CD" className="pl-9 font-mono uppercase" aria-label="Ticket code" />
          </div>
          <Button type="submit" variant="outline">Check</Button>
        </form>

        {result && <ResultCard result={result} eventTitle={eventsById[result.booking?.eventId]?.title || result.booking?.eventTitle} />}
      </div>

      <Card>
        <CardHeader title="Recent scans" />
        <ul className="divide-y">
          {history.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Scans appear here</li>}
          {history.map((h, i) => {
            const R = RESULT[h.kind]
            return (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <R.icon className={cn('size-4 shrink-0', R.tone.split(' ').find((c) => c.startsWith('text-')))} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{h.booking?.fullName || h.code}</p>
                  <p className="text-xs text-muted-foreground">{R.title}</p>
                </div>
                <span className="text-xs text-muted-foreground">{timeAgo(h.at)}</span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function ResultCard({ result, eventTitle }) {
  const R = RESULT[result.kind]
  const b = result.booking
  return (
    <div key={result.code + result.kind} className={cn('animate-fade-up flex items-start gap-4 rounded-2xl border-2 p-5', R.tone)}>
      <R.icon className="size-10 shrink-0" />
      <div className="min-w-0 text-foreground">
        <p className={cn('text-lg font-extrabold', R.tone.split(' ').find((c) => c.startsWith('text-')))}>{R.title}</p>
        {b ? (
          <>
            <p className="text-xl font-bold">{b.fullName}</p>
            <p className="text-sm text-muted-foreground">{b.tierName} · {eventTitle}</p>
            {b.regNumber && <p className="text-sm text-muted-foreground">Reg. no. {b.regNumber}</p>}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No ticket matches this code{result.error ? ` (${result.error})` : ''}.</p>
        )}
        <p className="mt-1 font-mono text-sm">{result.code}</p>
      </div>
    </div>
  )
}

function CameraView({ onCode }) {
  const onCodeRef = useRef(onCode)
  const [error, setError] = useState('')
  onCodeRef.current = onCode

  useEffect(() => {
    let scanner
    let cancelled = false
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (cancelled) return
      scanner = new Html5Qrcode('qr-reader', { verbose: false })
      scanner
        .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => onCodeRef.current(text), () => {})
        .catch((err) => setError(String(err?.message || err)))
    })
    return () => {
      cancelled = true
      scanner?.isScanning && scanner.stop().catch(() => {})
    }
  }, [])

  return (
    <Card className="overflow-hidden">
      <div id="qr-reader" className="mx-auto w-full max-w-md bg-black [&_video]:!w-full" />
      {error && <p className="p-4 text-sm text-danger">Camera unavailable: {error}. Allow camera access, or type codes below.</p>}
    </Card>
  )
}
