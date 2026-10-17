import { Link } from 'react-router-dom'
import { CalendarDays, Flame, GraduationCap, MapPin, Star } from 'lucide-react'
import { categoryOf, eventStats, formatDate, formatPrice, formatTime, isEnded } from '@/lib/utils'
import { Badge, Skeleton } from './ui/misc'
import { EventImage } from '@/components/EventImage'
import { SaveButton } from './SaveFollow'

export function EventCard({ event }) {
  const s = eventStats(event)
  const cat = categoryOf(event)
  const ended = isEnded(event)
  const month = new Date(`${event.date}T00:00`).toLocaleString('en', { month: 'short' })
  const day = new Date(`${event.date}T00:00`).getDate()

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <EventImage
          event={event}
          w={600}
          h={375}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3 pr-14">
          {event.featured && (
            <Badge variant="featured">
              <Star className="fill-current" /> Featured
            </Badge>
          )}
          {cat && cat.value !== 'other' && (
            <Badge variant="glass">
              {cat.emoji} {cat.label}
            </Badge>
          )}
          {event.type === 'school' && (
            <Badge variant="glass">
              <GraduationCap /> {event.school?.replace('School of ', '') || 'School'}
            </Badge>
          )}
        </div>
        <SaveButton eventId={event.id} className="absolute top-3 right-3" />
        <div className="absolute bottom-3 left-3 grid min-w-12 place-items-center rounded-lg bg-card px-2 py-1 text-center shadow-md">
          <span className="text-[10px] font-bold uppercase leading-none text-primary">{month}</span>
          <span className="text-lg font-extrabold leading-tight">{day}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-bold leading-snug transition-colors group-hover:text-primary">{event.title}</h3>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" /> {formatDate(event.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {formatTime(event.time)}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{event.venue}</span>
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-extrabold">
            {s.minPrice > 0 ? <><span className="text-xs font-semibold text-muted-foreground">from </span>{formatPrice(s.minPrice)}</> : 'Free'}
          </span>
          {ended ? (
            <Badge variant="outline">Ended</Badge>
          ) : s.soldOut ? (
            <Badge variant="danger">Sold out</Badge>
          ) : s.left <= 20 ? (
            <Badge variant="warning">
              <Flame /> {s.left} left
            </Badge>
          ) : (
            <Badge variant="success">Available</Badge>
          )}
        </div>
      </div>
    </Link>
  )
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-[16/10] rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}
