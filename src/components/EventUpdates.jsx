import { Megaphone } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeUpdates } from '@/services/updates'
import { cn, timeAgo } from '@/lib/utils'

/** Organizer announcements for an event, newest first. Renders nothing when there are none. */
export function EventUpdates({ eventId, className, compact = false }) {
  const { data: updates = [] } = useSubscription((ok, err) => subscribeUpdates(eventId, ok, err), [eventId], { initial: [], enabled: Boolean(eventId) })
  if (updates.length === 0) return null
  const shown = compact ? updates.slice(0, 2) : updates
  return (
    <section aria-label="Updates from the organizer" className={cn('overflow-hidden rounded-xl border border-warning/40 bg-warning-soft', className)}>
      <h2 className="flex items-center gap-2 px-4 pt-3 text-sm font-bold text-warning">
        <Megaphone className="size-4" /> {updates.length === 1 ? 'Update from the organizer' : `${updates.length} updates from the organizer`}
      </h2>
      <ul className="divide-y divide-warning/20">
        {shown.map((u) => (
          <li key={u.id} className="px-4 py-2.5">
            <p className="whitespace-pre-line text-sm text-foreground">{u.message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(u.createdAt) || 'just now'}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
