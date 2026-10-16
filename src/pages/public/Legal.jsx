import { CalendarX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'

function Page({ title, children }) {
  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:font-bold [&_h2]:text-foreground">{children}</div>
    </div>
  )
}

export function Terms() {
  return (
    <Page title="Terms of use">
      <p>By booking a ticket on UniVibe you agree to these terms.</p>
      <h2>Bookings</h2>
      <p>A ticket is valid only for the event, date and ticket type shown on it. Each QR code can be scanned once. Organizers may refuse entry to tickets that are copied or altered.</p>
      <h2>Cancellations</h2>
      <p>You can cancel your own booking from the ticket page until the event starts or your ticket is scanned. Released seats may be given to people on the waitlist.</p>
      <h2>Events</h2>
      <p>Events are run by the organizer listed on the event page. UniVibe is not responsible for changes, postponements or cancellations made by organizers.</p>
      <h2>Payments</h2>
      <p>Where a price is shown, payment is made to the organizer at the venue unless stated otherwise.</p>
    </Page>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy">
      <p>We collect only what an organizer needs to admit you to an event.</p>
      <h2>What we store</h2>
      <p>Your name, phone number, optional email, and for school events your registration number and school. This is stored with your booking.</p>
      <h2>Who can see it</h2>
      <p>Only you (on the device you booked with, or through your ticket link), the event’s organizer and UniVibe administrators. Other visitors cannot see bookings.</p>
      <h2>Email</h2>
      <p>If you give an email we use it only to send your ticket and updates about events you booked.</p>
      <h2>Deleting your data</h2>
      <p>Cancel your booking from the ticket page, or contact the event organizer to have your details removed.</p>
    </Page>
  )
}

export function NotFound() {
  return (
    <div className="container-page py-24">
      <EmptyState icon={CalendarX} title="Page not found" description="The page you’re looking for doesn’t exist." action={<Button to="/">Go home</Button>} />
    </div>
  )
}
