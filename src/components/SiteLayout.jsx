import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, Ticket, X } from 'lucide-react'
import { signOutVisitor, useAuth } from '@/hooks/useAuth'
import { FacebookIcon, InstagramIcon, XIcon } from './social-icons'
import { cn } from '@/lib/utils'
import { useSubscription } from '@/hooks/useSubscription'
import { subscribeSettings, DEFAULT_SETTINGS } from '@/services/settings'
import { Logo, ThemeToggle } from './brand'
import { Button } from './ui/button'

const navLink = ({ isActive }) =>
  cn('rounded-lg px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')

export function SiteLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { data: settings } = useSubscription(subscribeSettings, [], { initial: DEFAULT_SETTINGS })
  const { user } = useAuth()
  const googleUser = user?.isGoogle ? user : null

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink to="/" end className={navLink}>
              Events
            </NavLink>
            <a href="/#how-it-works" className={navLink({ isActive: false })}>
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button to="/my-tickets" variant={pathname === '/my-tickets' ? 'default' : 'soft'} size="md" className="hidden sm:inline-flex">
              <Ticket /> My tickets
            </Button>
            {googleUser && <AccountMenu user={googleUser} />}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {open && (
          <nav className="container-page animate-fade-up flex flex-col gap-1 border-t py-3 md:hidden" onClick={() => setOpen(false)}>
            <Link to="/" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-muted">Browse events</Link>
            <Link to="/my-tickets" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-muted">My tickets</Link>
            <a href="/#how-it-works" className="rounded-lg px-3 py-2.5 font-semibold hover:bg-muted">How it works</a>
            {googleUser && (
              <button onClick={signOutVisitor} className="rounded-lg px-3 py-2.5 text-left font-semibold text-muted-foreground hover:bg-muted">
                Sign out ({googleUser.email})
              </button>
            )}
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <SiteFooter socials={settings.socials} />
    </div>
  )
}

function AccountMenu({ user }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative hidden md:block">
      <button onClick={() => setOpen((o) => !o)} className="ml-1 grid size-9 place-items-center overflow-hidden rounded-full bg-muted text-sm font-bold uppercase ring-2 ring-transparent hover:ring-border" aria-label="Account" aria-expanded={open}>
        {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : (user.displayName || user.email || '?')[0]}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border bg-card p-1 shadow-xl">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Link to="/my-tickets" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><Ticket className="size-4" /> My tickets</Link>
            <button onClick={() => { setOpen(false); signOutVisitor() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"><LogOut className="size-4" /> Sign out</button>
          </div>
        </>
      )}
    </div>
  )
}

function SiteFooter({ socials }) {
  const links = [
    { href: socials.facebook, icon: FacebookIcon, label: 'Facebook' },
    { href: socials.instagram, icon: InstagramIcon, label: 'Instagram' },
    { href: socials.twitter, icon: XIcon, label: 'X / Twitter' },
  ].filter((l) => l.href)

  return (
    <footer className="mt-20 border-t bg-card">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">Discover, book and attend the best events on campus. Your ticket lives on your phone.</p>
          {links.length > 0 && (
            <div className="flex gap-1">
              {links.map(({ href, icon: Icon, label }) => (
                <Button key={label} href={href} target="_blank" rel="noreferrer" variant="ghost" size="icon" aria-label={label}>
                  <Icon />
                </Button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">Attendees</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-foreground">Browse events</Link></li>
            <li><Link to="/my-tickets" className="hover:text-foreground">My tickets</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold">UniVibe</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="/admin" className="hover:text-foreground">Organizer login</a></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
            <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} UniVibe. Made for students.</div>
    </footer>
  )
}
