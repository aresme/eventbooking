import { useState } from 'react'
import { CheckCircle2, Inbox as InboxIcon, Mail, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { deleteMessage, setMessageStatus, subscribeMessages } from '@/services/messages'
import { cn, timeAgo, toDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, Card, EmptyState, Segmented, Skeleton } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'
import { WhatsAppIcon } from '@/components/social-icons'

const TOPIC = { booking: 'Booking', organizer: 'Hosting', bug: 'Problem', other: 'Other' }

export default function Inbox() {
  const { isAdmin } = useAuth()
  const confirm = useConfirm()
  const [tab, setTab] = useState('open')
  const { data: messages = [], loading } = useSubscription(subscribeMessages, [], { initial: [], enabled: isAdmin })
  if (!isAdmin) return <EmptyState title="Admins only" />

  const list = messages.filter((m) => tab === 'all' || m.status === tab)
  const open = messages.filter((m) => m.status === 'open').length

  return (
    <div className="space-y-5">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'open', label: `Open (${open})` },
          { value: 'resolved', label: 'Resolved' },
          { value: 'all', label: 'All' },
        ]}
      />
      {loading ? (
        <Skeleton className="h-64" />
      ) : list.length === 0 ? (
        <EmptyState icon={InboxIcon} title={tab === 'open' ? 'Inbox zero' : 'No messages'} description="Messages from the Contact page show up here." />
      ) : (
        <div className="space-y-3">
          {list.map((m) => (
            <Message
              key={m.id}
              m={m}
              onToggle={() => setMessageStatus(m.id, m.status === 'open' ? 'resolved' : 'open')}
              onDelete={async () => (await confirm({ title: 'Delete this message?', confirmLabel: 'Delete', danger: true })) && deleteMessage(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Message({ m, onToggle, onDelete }) {
  const isEmail = m.contact.includes('@')
  const phone = m.contact.replace(/\D/g, '').replace(/^0/, '254')
  const replyHref = isEmail
    ? `mailto:${m.contact}?subject=${encodeURIComponent('Re: your message to UniVibe')}&body=${encodeURIComponent(`Hi ${m.name.split(' ')[0]},\n\n`)}`
    : `https://wa.me/${phone}?text=${encodeURIComponent(`Hi ${m.name.split(' ')[0]}, this is UniVibe replying to your message.`)}`

  return (
    <Card className={cn('p-5', m.status !== 'open' && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold">{m.name}</p>
        <span className="text-sm text-muted-foreground">{m.contact}</span>
        <Badge variant="outline">{TOPIC[m.topic] || m.topic}</Badge>
        {m.status === 'open' && <Badge variant="primary">Open</Badge>}
        <time className="ml-auto text-xs text-muted-foreground" title={toDate(m.createdAt)?.toLocaleString()}>{timeAgo(m.createdAt)}</time>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{m.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button href={replyHref} target="_blank" size="sm">
          {isEmail ? <Mail /> : <WhatsAppIcon />} Reply
        </Button>
        <Button variant="outline" size="sm" onClick={onToggle}>
          {m.status === 'open' ? <><CheckCircle2 /> Mark resolved</> : <><RotateCcw /> Reopen</>}
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-danger" onClick={onDelete}>
          <Trash2 /> Delete
        </Button>
      </div>
    </Card>
  )
}
