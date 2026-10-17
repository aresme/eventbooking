import { createContext, useContext, useMemo, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  ExternalLink,
  Hourglass,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PlusCircle,
  ScanLine,
  Settings,
  Ticket,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeManagedEvents } from '@/services/events'
import { subscribeManagedBookings } from '@/services/bookings'
import { subscribeManagedWaitlist } from '@/services/waitlist'
import { staffSignOut } from '@/services/users'
import { cn } from '@/lib/utils'
import { Logo, ThemeToggle } from '@/components/brand'
import { Button } from '@/components/ui/button'
import Login, { PendingApproval } from './Login'

const DataContext = createContext(null)
export const useDashboard = () => useContext(DataContext)

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/events/new', label: 'New event', icon: PlusCircle },
  { to: '/admin/bookings', label: 'Bookings', icon: Ticket },
  { to: '/admin/waitlist', label: 'Waitlist', icon: Hourglass, badge: 'waitlist' },
  { to: '/admin/scanner', label: 'Check-in', icon: ScanLine },
  { to: '/admin/organizers', label: 'Organizers', icon: Users, adminOnly: true, badge: 'pending' },
  { to: '/admin/door-staff', label: 'Door staff', icon: ShieldCheck },
  { to: '/admin/activity', label: 'Activity', icon: Activity },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const DOOR_PAGES = ['/admin/scanner', '/admin/settings']

export default function DashboardLayout() {
  const { loading, user, role, isStaff, isDoor } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!user || user.isAnonymous) return <Login />
  if (!isStaff && !isDoor) return <PendingApproval role={role} />
  return <StaffShell />
}

function StaffShell() {
  const { user, isAdmin, isDoor } = useAuth()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  // Door staff see their organizer's data; services treat any non-admin role as "owned by uid".
  const scope = isDoor ? { uid: user.profile.ownerId, role: 'door' } : { uid: user.uid, role: user.role }

  const events = useSubscription((ok, err) => subscribeManagedEvents(scope, ok, err), [user.uid, user.role], { initial: [] })
  const bookings = useSubscription((ok, err) => subscribeManagedBookings(scope, ok, err), [user.uid, user.role], { initial: [] })
  const waitlist = useSubscription((ok, err) => subscribeManagedWaitlist(scope, ok, err), [user.uid, user.role], { initial: [], enabled: !isDoor })

  const data = useMemo(() => {
    const eventsById = Object.fromEntries((events.data || []).map((e) => [e.id, e]))
    return {
      events: events.data || [],
      bookings: bookings.data || [],
      waitlist: waitlist.data || [],
      eventsById,
      scope,
      loading: events.loading || bookings.loading || waitlist.loading,
      error: events.error || bookings.error || waitlist.error,
    }
  }, [events, bookings, waitlist]) // eslint-disable-line react-hooks/exhaustive-deps

  const badges = { waitlist: data.waitlist.length }
  const current = NAV.filter((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))).sort((a, b) => b.to.length - a.to.length)[0]

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3" aria-label="Dashboard">
      <div className="mb-4 flex items-center justify-between px-2 pt-1">
        <Logo to="/admin" suffix={isAdmin ? 'Admin' : isDoor ? 'Door' : 'Organizer'} />
      </div>
      {NAV.filter((n) => (isDoor ? DOOR_PAGES.includes(n.to) : !n.adminOnly || isAdmin)).map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? to === '/admin/events'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors [&_svg]:size-4',
              isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon /> {label}
          {badge && badges[badge] > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{badges[badge]}</span>}
        </NavLink>
      ))}
      <div className="mt-auto space-y-1 border-t pt-3">
        <a href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4">
          <ExternalLink /> View site
        </a>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold uppercase">{(user.profile?.displayName || user.email || '?')[0]}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.profile?.displayName || 'Staff'}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={staffSignOut} aria-label="Sign out">
            <LogOut />
          </Button>
        </div>
      </div>
    </nav>
  )

  return (
    <DataContext.Provider value={data}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-dvh border-r bg-card lg:block">{sidebar}</aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="animate-fade-up absolute inset-y-0 left-0 w-72 border-r bg-card">{sidebar}</aside>
          </div>
        )}

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-lg sm:px-6">
            <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              {open ? <X /> : <Menu />}
            </Button>
            <h1 className="flex-1 truncate font-bold">{current?.label || 'Dashboard'}</h1>
            <ThemeToggle />
          </header>
          <main className="mx-auto max-w-6xl p-4 sm:p-6">
            {data.error ? (
              <div className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
                Couldn’t load dashboard data: {data.error.message}. If you just set up the project, deploy the Firestore rules and indexes.
              </div>
            ) : isDoor && !DOOR_PAGES.includes(pathname) ? (
              <Navigate to="/admin/scanner" replace />
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </DataContext.Provider>
  )
}
