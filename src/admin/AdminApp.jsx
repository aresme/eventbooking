import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import AdminLayout from './pages/DashboardLayout'
import Overview from './pages/Overview'

// Heavier pages load on first visit.
const Events = lazy(() => import('./pages/Events'))
const EventForm = lazy(() => import('./pages/EventForm'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Waitlist = lazy(() => import('./pages/Waitlist'))
const Scanner = lazy(() => import('./pages/Scanner'))
const Organizers = lazy(() => import('./pages/Organizers'))
const Activity = lazy(() => import('./pages/Activity'))
const Settings = lazy(() => import('./pages/Settings'))

const page = (el) => (
  <Suspense fallback={<div className="grid h-64 place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>{el}</Suspense>
)

const router = createBrowserRouter([
  {
    path: '/admin',
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
      { path: 'activity', element: page(<Activity />) },
      { path: 'settings', element: page(<Settings />) },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/admin" replace /> },
])

export default function AdminApp() {
  return (
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  )
}
