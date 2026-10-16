import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { SiteLayout } from '@/components/SiteLayout'
import Home from '@/pages/public/Home'
import EventDetail from '@/pages/public/EventDetail'
import Ticket from '@/pages/public/Ticket'
import MyTickets from '@/pages/public/MyTickets'
import { NotFound, Privacy, Terms } from '@/pages/public/Legal'

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
          { path: '/terms', element: <Terms /> },
          { path: '/privacy', element: <Privacy /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  )
}
