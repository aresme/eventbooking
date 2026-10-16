import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarSearch, Flame, Gift, Globe, GraduationCap, LayoutGrid, QrCode, Search, Ticket, CalendarDays, X } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribePublishedEvents } from '@/services/events'
import { eventStats, formatDate, formatTime, isEnded } from '@/lib/utils'
import { EventCard, EventCardSkeleton } from '@/components/EventCard'
import { Button } from '@/components/ui/button'
import { Badge, EmptyState, Segmented } from '@/components/ui/misc'
import { EventImage } from '@/components/EventImage'

const FILTERS = [
  { value: 'all', label: 'All', icon: LayoutGrid },
  { value: 'week', label: 'This week', icon: CalendarDays },
  { value: 'trending', label: 'Trending', icon: Flame },
  { value: 'school', label: 'School', icon: GraduationCap },
  { value: 'normal', label: 'Open', icon: Globe },
  { value: 'free', label: 'Free', icon: Gift },
]

const PAGE = 9

export default function Home() {
  const { data: events = [], loading, error } = useSubscription(subscribePublishedEvents, [], { initial: [] })
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [showPast, setShowPast] = useState(false)

  const upcoming = useMemo(() => events.filter((e) => !isEnded(e)), [events])
  const featured = useMemo(() => upcoming.filter((e) => e.featured).sort(byDate).slice(0, 1)[0], [upcoming])

  const filtered = useMemo(() => {
    let list = showPast ? events : upcoming
    const weekEnd = Date.now() + 7 * 86400000
    if (filter === 'school') list = list.filter((e) => e.type === 'school')
    if (filter === 'normal') list = list.filter((e) => e.type === 'normal')
    if (filter === 'free') list = list.filter((e) => eventStats(e).minPrice === 0)
    if (filter === 'week') list = list.filter((e) => new Date(`${e.date}T23:59`) <= weekEnd)
    const term = q.trim().toLowerCase()
    if (term) {
      list = list.filter((e) => [e.title, e.venue, e.school, e.description].some((f) => f?.toLowerCase().includes(term)))
    }
    return [...list].sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1
      if (filter === 'trending') return eventStats(b).booked - eventStats(a).booked
      return byDate(a, b)
    })
  }, [events, upcoming, filter, q, showPast])

  const totalBooked = events.reduce((s, e) => s + eventStats(e).booked, 0)

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b">
        <div className="hero-glow absolute inset-0 -z-10" />
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-fade-up">
            <Badge variant="primary" className="mb-5">
              <Ticket /> Campus events, one tap away
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Find your next <span className="text-primary">campus vibe.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground text-pretty">
              Concerts, hackathons, galas and school events. Book in seconds and carry your QR ticket on your phone.
            </p>

            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="mt-8 flex max-w-lg items-center gap-2 rounded-xl border bg-card p-1.5 shadow-card focus-within:ring-3 focus-within:ring-primary/15"
            >
              <Search className="ml-2.5 size-5 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events, venues, schools…"
                aria-label="Search events"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit">Search</Button>
            </form>

            <dl className="mt-8 flex gap-8">
              <Stat value={upcoming.length} label="Upcoming events" />
              <Stat value={totalBooked} label="Tickets booked" />
            </dl>
          </div>

          {featured ? <FeaturedCard event={featured} /> : <HeroArt />}
        </div>
      </section>

      {/* ---------- event list ---------- */}
      <section id="events" className="container-page scroll-mt-20 py-12">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{q ? `Results for “${q}”` : 'Upcoming events'}</h2>
            {!loading && (
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered.length} event{filtered.length === 1 ? '' : 's'}
                {q && (
                  <button onClick={() => setQ('')} className="ml-2 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                    <X className="size-3.5" /> Clear search
                  </button>
                )}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} className="accent-[var(--primary)]" />
            Show past events
          </label>
        </div>

        <Segmented
          options={FILTERS}
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setLimit(PAGE)
          }}
          className="-mx-4 mb-8 px-4 sm:mx-0 sm:px-0"
        />

        {error ? (
          <EmptyState icon={CalendarSearch} title="Couldn't load events" description="Check your connection and refresh the page." />
        ) : loading ? (
          <Grid>{Array.from({ length: 6 }, (_, i) => <EventCardSkeleton key={i} />)}</Grid>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarSearch}
            title="No events found"
            description={q ? 'Try a different search term or filter.' : 'New events are added all the time. Check back soon.'}
            action={(q || filter !== 'all') && <Button variant="outline" onClick={() => { setQ(''); setFilter('all') }}>Reset filters</Button>}
          />
        ) : (
          <>
            <Grid>
              {filtered.slice(0, limit).map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </Grid>
            {limit < filtered.length && (
              <div className="mt-10 text-center">
                <Button variant="outline" size="lg" onClick={() => setLimit((l) => l + PAGE)}>
                  Show more events
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how-it-works" className="container-page scroll-mt-20 py-12">
        <div className="rounded-2xl border bg-card p-6 sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mt-1 text-muted-foreground">No account needed. Your tickets are saved on this device.</p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { icon: Search, title: 'Find an event', text: 'Browse or search what’s happening on campus.' },
              { icon: Ticket, title: 'Book in seconds', text: 'Pick a ticket, add your name and phone. Done.' },
              { icon: QrCode, title: 'Show your QR', text: 'Scan in at the door straight from your phone.' },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground">STEP {i + 1}</p>
                  <h3 className="font-bold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}

function byDate(a, b) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
}

function Grid({ children }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function Stat({ value, label }) {
  return (
    <div>
      <dd className="text-3xl font-extrabold tabular-nums">{value.toLocaleString()}</dd>
      <dt className="text-sm text-muted-foreground">{label}</dt>
    </div>
  )
}

function FeaturedCard({ event }) {
  return (
    <Link to={`/events/${event.id}`} className="group animate-fade-up relative block overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5 [animation-delay:120ms]">
      <EventImage event={event} w={900} h={640} className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <Badge variant="featured" className="mb-3">Featured</Badge>
        <h2 className="text-2xl font-extrabold leading-tight">{event.title}</h2>
        <p className="mt-1 text-sm text-white/80">
          {formatDate(event.date)} · {formatTime(event.time)} · {event.venue}
        </p>
      </div>
    </Link>
  )
}

function HeroArt() {
  return (
    <div className="relative mx-auto hidden aspect-square w-full max-w-md lg:block" aria-hidden="true">
      <div className="absolute inset-8 rotate-6 rounded-3xl bg-primary shadow-2xl" />
      <div className="absolute inset-8 -rotate-3 rounded-3xl border bg-card p-8 shadow-2xl">
        <div className="h-3 w-24 rounded-full bg-primary/80" />
        <div className="mt-4 h-6 w-3/4 rounded-full bg-muted" />
        <div className="mt-2 h-4 w-1/2 rounded-full bg-muted" />
        <div className="mt-10 grid place-items-center">
          <QrCode className="size-36 text-foreground/80" strokeWidth={1.2} />
        </div>
      </div>
    </div>
  )
}
