import { toast } from 'sonner'
import { Check, ShieldCheck, UserMinus, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { setUserRole, subscribeUsers } from '@/services/users'
import { timeAgo } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/misc'
import { useConfirm } from '@/components/ui/dialog'
import { useDashboard } from './DashboardLayout'

const ROLE = {
  admin: { label: 'Admin', variant: 'primary' },
  organizer: { label: 'Organizer', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  revoked: { label: 'Revoked', variant: 'outline' },
}

export default function Organizers() {
  const { user, isAdmin } = useAuth()
  const { events } = useDashboard()
  const confirm = useConfirm()
  const { data: users = [], loading } = useSubscription(subscribeUsers, [], { initial: [], enabled: isAdmin })

  if (!isAdmin) return <EmptyState title="Admins only" />

  const pending = users.filter((u) => u.role === 'pending')
  const others = users.filter((u) => u.role !== 'pending').sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1))

  async function change(u, role, message) {
    if (role !== 'organizer') {
      const ok = await confirm({
        title: role === 'admin' ? `Make ${u.displayName} an admin?` : `Remove ${u.displayName}’s access?`,
        description: role === 'admin' ? 'Admins can see and change everything, including other organizers.' : 'They won’t be able to sign in to the dashboard. Their events stay.',
        confirmLabel: role === 'admin' ? 'Make admin' : 'Remove access',
        danger: role !== 'admin',
      })
      if (!ok) return
    }
    try {
      await setUserRole(u.id, role)
      toast.success(message)
    } catch {
      toast.error('Could not update role')
    }
  }

  const row = (u) => {
    const r = ROLE[u.role] || ROLE.revoked
    const count = events.filter((e) => e.ownerId === u.id).length
    return (
      <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="grid size-9 place-items-center rounded-full bg-muted text-sm font-bold uppercase">{(u.displayName || u.email || '?')[0]}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {u.displayName} {u.id === user.uid && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {u.email}
            {u.org && ` · ${u.org}`} · {count} event{count === 1 ? '' : 's'}
            {u.createdAt && ` · joined ${timeAgo(u.createdAt)}`}
          </p>
        </div>
        <Badge variant={r.variant}>{r.label}</Badge>
        {u.id !== user.uid && (
          <div className="flex gap-1">
            {u.role === 'pending' || u.role === 'revoked' ? (
              <Button size="sm" onClick={() => change(u, 'organizer', `${u.displayName} approved`)}>
                <Check /> Approve
              </Button>
            ) : u.role === 'organizer' ? (
              <Button size="sm" variant="ghost" onClick={() => change(u, 'admin', `${u.displayName} is now an admin`)}>
                <ShieldCheck /> Make admin
              </Button>
            ) : null}
            {u.role !== 'revoked' && (
              <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-danger" onClick={() => change(u, 'revoked', 'Access removed')} aria-label="Remove access">
                <UserMinus />
              </Button>
            )}
          </div>
        )}
      </li>
    )
  }

  if (loading) return <Skeleton className="h-64" />

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader title="Waiting for approval" description="These people applied to host events." />
          <ul className="divide-y">{pending.map(row)}</ul>
        </Card>
      )}
      <Card>
        <CardHeader title="Team" description="Organizers manage only their own events. Admins approve events and manage everyone." />
        {others.length === 0 ? <EmptyState icon={Users} title="No organizers yet" className="m-5" description="Share /admin so clubs can apply." /> : <ul className="divide-y">{others.map(row)}</ul>}
      </Card>
    </div>
  )
}
