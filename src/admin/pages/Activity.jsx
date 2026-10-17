import { Activity as ActivityIcon, ArrowUpCircle, Megaphone, CalendarPlus, CheckCircle2, Eye, EyeOff, Pencil, Trash2, XCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeLogs } from '@/services/logs'
import { timeAgo, toDate } from '@/lib/utils'
import { Card, EmptyState, Skeleton } from '@/components/ui/misc'

const ACTIONS = {
  check_in: { icon: CheckCircle2, tone: 'text-success', text: (l) => <><b>{l.attendeeName}</b> checked in to {l.eventTitle} <span className="font-mono text-xs">({l.ticketCode})</span></> },
  booking_cancelled: { icon: XCircle, tone: 'text-danger', text: (l) => <>Cancelled <b>{l.attendeeName}</b>’s booking for {l.eventTitle}</> },
  waitlist_promoted: { icon: ArrowUpCircle, tone: 'text-primary', text: (l) => <>Promoted <b>{l.attendeeName}</b> from the waitlist</> },
  waitlist_removed: { icon: Trash2, tone: 'text-muted-foreground', text: (l) => <>Removed <b>{l.attendeeName}</b> from the waitlist</> },
  event_created: { icon: CalendarPlus, tone: 'text-primary', text: (l) => <>Created <b>{l.eventTitle}</b></> },
  event_updated: { icon: Pencil, tone: 'text-muted-foreground', text: (l) => <>Edited <b>{l.eventTitle}</b></> },
  event_published: { icon: Eye, tone: 'text-success', text: (l) => <>Published <b>{l.eventTitle}</b></> },
  event_hidden: { icon: EyeOff, tone: 'text-muted-foreground', text: (l) => <>Hid <b>{l.eventTitle}</b></> },
  event_pending: { icon: Eye, tone: 'text-warning', text: (l) => <>Submitted <b>{l.eventTitle}</b> for approval</> },
  event_update_posted: { icon: Megaphone, tone: 'text-warning', text: (l) => <>Posted an update on <b>{l.eventTitle}</b></> },
  event_deleted: { icon: Trash2, tone: 'text-danger', text: (l) => <>Deleted <b>{l.eventTitle}</b></> },
}

export default function Activity() {
  const { user } = useAuth()
  const { data: logs = [], loading } = useSubscription((ok, err) => subscribeLogs(user, ok, err), [user.uid, user.role], { initial: [] })

  if (loading) return <Skeleton className="h-96" />
  if (logs.length === 0) return <EmptyState icon={ActivityIcon} title="No activity yet" description="Check-ins, cancellations and event changes show up here." />

  return (
    <Card>
      <ul className="divide-y">
        {logs.map((l) => {
          const a = ACTIONS[l.action] || { icon: ActivityIcon, tone: 'text-muted-foreground', text: () => l.action }
          return (
            <li key={l.id} className="flex items-start gap-3 px-5 py-3">
              <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone}`} />
              <div className="min-w-0 flex-1 text-sm">
                <p>{a.text(l)}</p>
                <p className="text-xs text-muted-foreground">
                  {l.actorName} · <time title={toDate(l.createdAt)?.toLocaleString()}>{timeAgo(l.createdAt)}</time>
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
