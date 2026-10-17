import { lazy, Suspense, useState } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PORTALS, PortalContext } from './portal'
import AdminLayout from './pages/DashboardLayout'
import Overview from './pages/Overview'

// Heavier pages load on first visit.
const Events = lazy(() => import('./pages/Events'))
const EventForm = lazy(() => import('./pages/EventForm'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Waitlist = lazy(() => import('./pages/Waitlist'))
const Scanner = lazy(() => import('./pages/Scanner'))
const Organizers = lazy(() => import('./pages/Organizers'))
const DoorStaff = lazy(() => import('./pages/DoorStaff'))
const Inbox = lazy(() => import('./pages/Inbox'))
const Activity = lazy(() => import('./pages/Activity'))
const Settings = lazy(() => import('./pages/Settings'))

const page = (el) => (
  <Suspense fallback={<div className="grid h-64 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>{el}</Suspense>
)

const routes = [
  {
    path: '/',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'events', element: page(<Events />) },
      { path: 'events/new', element: page(<EventForm />) },
      { path: 'events/:eventId/edit', element: page(<EventForm />) },
      { path: 'bookings', element: page(<Bookings />) },
      { path: 'waitlist', element: page(<Waitlist />) },
      { path: 'scanner', element: page(<Scanner />) },
      { path: 'organizers', element: page(<Organizers />) },
      { path: 'door-staff', element: page(<DoorStaff />) },
      { path: 'inbox', element: page(<Inbox />) },
      { path: 'activity', element: page(<Activity />) },
      { path: 'settings', element: page(<Settings />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

/** One dashboard app, mounted at /admin or /organizer (see portal.js). */
export default function AdminApp({ portal = 'admin' }) {
  const config = PORTALS[portal]
  const [router] = useState(() => createBrowserRouter(routes, { basename: config.base }))
  return (
    <AppShell>
      <PortalContext.Provider value={config}>
        <RouterProvider router={router} />
      </PortalContext.Provider>
    </AppShell>
  )
}
