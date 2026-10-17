import { useState } from 'react'
import { toast } from 'sonner'
import { Megaphone, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { deleteUpdate, postUpdate, subscribeUpdates } from '@/services/updates'
import { attendeeEmailCount, sendUpdateToAttendees, updateEmailsEnabled } from '@/services/email'
import { Switch } from '@/components/ui/form'
import { useDashboard } from './DashboardLayout'
import { timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/form'
import { Dialog } from '@/components/ui/dialog'

const TEMPLATES = ['Venue changed to ', 'Start time moved to ', 'Reminder: bring your student ID.', 'Doors open 30 minutes early.']

export default function UpdatesDialog({ event, onClose }) {
  return (
    <Dialog open={Boolean(event)} onClose={onClose} title="Post an update" description={event ? `Shown on the event page and on every ticket for ${event.title}.` : ''} size="lg">
      {event && <Updates event={event} />}
    </Dialog>
  )
}

function Updates({ event }) {
  const { user } = useAuth()
  const { data: updates = [] } = useSubscription((ok, err) => subscribeUpdates(event.id, ok, err), [event.id], { initial: [] })
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [emailToo, setEmailToo] = useState(false)
  const { bookings } = useDashboard()
  const eventBookings = bookings.filter((b) => b.eventId === event.id)
  const emailCount = attendeeEmailCount(eventBookings)

  async function post(e) {
    e.preventDefault()
    if (!message.trim()) return
    setPosting(true)
    try {
      await postUpdate(event, message, user)
      if (emailToo && emailCount > 0) {
        toast.info(`Emailing ${emailCount} attendee${emailCount > 1 ? 's' : ''}…`)
        const { sent, total } = await sendUpdateToAttendees({ event, message: message.trim(), bookings: eventBookings })
        toast[sent === total ? 'success' : 'warning'](`Update posted and emailed to ${sent} of ${total}`)
      } else {
        toast.success('Update posted')
      }
      setMessage('')
      setEmailToo(false)
    } catch {
      toast.error('Could not post the update')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={post} className="space-y-2">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 500))} rows={3} placeholder="e.g. Venue changed to Senate Hall. Same time." aria-label="Update message" />
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button key={t} type="button" onClick={() => setMessage(t)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              {t.trim()}
            </button>
          ))}
        </div>
        {updateEmailsEnabled && (
          <Switch
            checked={emailToo}
            onChange={setEmailToo}
            label={`Also email attendees (${emailCount})`}
            description={emailCount ? 'Uses one email per attendee from your EmailJS allowance (200/month on the free plan).' : 'No attendees gave an email address.'}
            className="rounded-lg border p-3"
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{message.length}/500</span>
          <Button type="submit" loading={posting} disabled={!message.trim()}>
            {!posting && <Megaphone />} Post update
          </Button>
        </div>
      </form>

      {updates.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {updates.map((u) => (
            <li key={u.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line text-sm">{u.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(u.createdAt) || 'just now'}</p>
              </div>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-danger" aria-label="Delete update" onClick={() => deleteUpdate(event.id, u.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
