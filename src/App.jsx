import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AuthProvider } from '@/hooks/useAuth'
import { firebaseConfigured } from '@/lib/firebase'
import { ConfirmProvider } from '@/components/ui/dialog'
import { SiteLayout } from '@/components/SiteLayout'
import Home from '@/pages/public/Home'
import EventDetail from '@/pages/public/EventDetail'
import Ticket from '@/pages/public/Ticket'
import MyTickets from '@/pages/public/MyTickets'
import { NotFound, Privacy, Terms } from '@/pages/public/Legal'

// The dashboard (charts, scanner…) is only downloaded by staff.
const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout'))
const Overview = lazy(() => import('@/pages/dashboard/Overview'))
const Events = lazy(() => import('@/pages/dashboard/Events'))
const EventForm = lazy(() => import('@/pages/dashboard/EventForm'))
const Bookings = lazy(() => import('@/pages/dashboard/Bookings'))
const Waitlist = lazy(() => import('@/pages/dashboard/Waitlist'))
const Scanner = lazy(() => import('@/pages/dashboard/Scanner'))
const Organizers = lazy(() => import('@/pages/dashboard/Organizers'))
const Activity = lazy(() => import('@/pages/dashboard/Activity'))
const Settings = lazy(() => import('@/pages/dashboard/Settings'))

function Root() {
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>}>
        <Outlet />
      </Suspense>
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <SiteLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/events/:eventId', element: <EventDetail /> },
          { path: '/tickets/:bookingId', element: <Ticket /> },
          { path: '/my-tickets', element: <MyTickets /> },
          { path: '/terms', element: <Terms /> },
          { path: '/privacy', element: <Privacy /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'events', element: <Events /> },
          { path: 'events/new', element: <EventForm /> },
          { path: 'events/:eventId/edit', element: <EventForm /> },
          { path: 'bookings', element: <Bookings /> },
          { path: 'waitlist', element: <Waitlist /> },
          { path: 'scanner', element: <Scanner /> },
          { path: 'organizers', element: <Organizers /> },
          { path: 'activity', element: <Activity /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
])

export default function App() {
  if (!firebaseConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
      </ConfirmProvider>
    </AuthProvider>
  )
}

function SetupNotice() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 shadow-card">
        <h1 className="text-xl font-extrabold">Firebase isn’t configured</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code>, fill in your Firebase web app keys, then restart <code className="rounded bg-muted px-1">npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
