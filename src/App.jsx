import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { PeopleProvider } from '@/hooks/usePeople'
import { SiteLayout } from '@/components/SiteLayout'
import Home from '@/pages/public/Home'
import EventDetail from '@/pages/public/EventDetail'
import Ticket from '@/pages/public/Ticket'
import MyTickets from '@/pages/public/MyTickets'
import { NotFound, Privacy, Terms } from '@/pages/public/Legal'
import AdminRedirect from '@/pages/public/AdminRedirect'
import Club from '@/pages/public/Club'

// Public site only. The admin area is a separate page: admin.html → src/admin/main.jsx
const router = createBrowserRouter([
  {
    element: (
      <>
        <ScrollRestoration />
        <Outlet />
      </>
    ),
    children: [
      {
        element: <SiteLayout />,
        children: [
          { path: '/', element: <Home /> },
          { path: '/events/:eventId', element: <EventDetail /> },
          { path: '/tickets/:bookingId', element: <Ticket /> },
          { path: '/my-tickets', element: <MyTickets /> },
          { path: '/clubs/:clubId', element: <Club /> },
          { path: '/terms', element: <Terms /> },
          { path: '/privacy', element: <Privacy /> },
          { path: '/admin/*', element: <AdminRedirect /> },
          { path: '/dashboard/*', element: <AdminRedirect /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <AppShell>
      <PeopleProvider>
        <RouterProvider router={router} />
      </PeopleProvider>
    </AppShell>
  )
}
