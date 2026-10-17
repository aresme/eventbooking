import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Globe, Users } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeClub, subscribeClubEvents } from '@/services/clubs'
import { isEnded } from '@/lib/utils'
import { EventCard, EventCardSkeleton } from '@/components/EventCard'
import { InstagramIcon } from '@/components/social-icons'
import { Button } from '@/components/ui/button'
import { EmptyState, Skeleton } from '@/components/ui/misc'

export default function Club() {
  const { clubId } = useParams()
  const { data: club, loading } = useSubscription((ok, err) => subscribeClub(clubId, ok, err), [clubId])
  const { data: events = [], loading: eventsLoading } = useSubscription((ok, err) => subscribeClubEvents(clubId, ok, err), [clubId], { initial: [] })

  // Clubs that never filled in a profile still get a page, named from their events.
  const name = club?.name || events[0]?.ownerName || 'Organizer'

  const [upcoming, past] = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
    return [sorted.filter((e) => !isEnded(e)), sorted.filter(isEnded).reverse()]
  }, [events])

  useEffect(() => {
    document.title = `${name} · UniVibe`
    return () => {
      document.title = 'UniVibe · Campus Events'
    }
  }, [name])

  if (!loading && !eventsLoading && !club && events.length === 0) {
    return (
      <div className="container-page py-20">
        <EmptyState icon={Users} title="Club not found" description="This organizer has no public page yet." action={<Button to="/">Browse events</Button>} />
      </div>
    )
  }

  return (
    <div className="container-page py-10">
      <header className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        {loading ? (
          <Skeleton className="size-20 rounded-2xl" />
        ) : club?.logo ? (
          <img src={club.logo} alt="" className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-border" />
        ) : (
          <div className="grid size-20 shrink-0 place-items-center rounded-2xl bg-primary text-3xl font-extrabold text-primary-foreground">{name[0]}</div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
          {club?.bio && <p className="mt-2 max-w-2xl whitespace-pre-line text-muted-foreground">{club.bio}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {events.length} event{events.length === 1 ? '' : 's'}
            </span>
            {club?.website && (
              <a href={club.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
                <Globe className="size-4" /> Website
              </a>
            )}
            {club?.instagram && (
              <a href={club.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-foreground">
                <InstagramIcon className="size-4" /> Instagram
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="mb-5 text-xl font-extrabold">Upcoming events</h2>
        {eventsLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} />)}</div>
        ) : upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No upcoming events" description="Check back soon." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-5 text-xl font-extrabold text-muted-foreground">Past events</h2>
          <div className="grid gap-5 opacity-80 sm:grid-cols-2 lg:grid-cols-3">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
    </div>
  )
}
