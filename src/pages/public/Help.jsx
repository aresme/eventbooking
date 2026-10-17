import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SECTIONS = [
  {
    title: 'Booking tickets',
    items: [
      { q: 'Do I need an account to book?', a: 'No. Pick an event, choose a ticket and enter your name and phone number. Your ticket is saved on the device you booked with.' },
      { q: 'How do I pay for paid events?', a: 'Payment is made to the organizer at the venue unless the event page says otherwise. Show your ticket QR code at the entrance.' },
      { q: 'How many tickets can I book?', a: 'Most events allow one ticket per person. Some let you book several. The event page shows the limit.' },
      { q: 'How do promo codes work?', a: 'Organizers share codes for discounts or free entry. Tap “Have a promo code?” on the confirm step to apply one.' },
      { q: 'The event is sold out. What now?', a: 'Join the waitlist on the event page. If a seat opens up, the organizer can give it to you and you’ll find the ticket under My tickets (and in your email, if you added one).' },
    ],
  },
  {
    title: 'My tickets',
    items: [
      { q: 'Where are my tickets?', a: 'Open “My tickets” at the top of the page. Every ticket also has its own link you can bookmark or share with yourself.' },
      { q: 'I changed phones or cleared my browser.', a: 'Sign in with Google on “My tickets” to keep tickets across devices. If you booked without signing in, use the ticket link from your confirmation email, or contact us with your name, phone and event.' },
      { q: 'Can I cancel a booking?', a: 'Yes, until the event starts or your ticket is scanned. Open the ticket and tap “Cancel booking”. Your seat goes back on sale.' },
      { q: 'Can I give my ticket to a friend?', a: 'Tickets are linked to the name on the booking. Ask the organizer, or cancel and let your friend book.' },
    ],
  },
  {
    title: 'For organizers',
    items: [
      { q: 'How do I host events on UniVibe?', a: 'Go to univibe-events-9c77f.web.app/organizer (or “Host events” at the bottom of any page) and tap “Apply as organizer”. An admin approves your account, then you can sign in there and create events.' },
      { q: 'Why isn’t my event visible yet?', a: 'New events from organizers are reviewed by an admin before they go public. You’ll see “Awaiting approval” in your dashboard until then.' },
      { q: 'How do I check people in?', a: 'Open Check-in in your dashboard and scan ticket QR codes with your phone camera. You can also create scanner-only logins for volunteers under Door staff.' },
      { q: 'Can I change the venue or time after publishing?', a: 'Yes. Edit the event, then use “Post update” so everyone with a ticket sees the change.' },
    ],
  },
]

export default function Help() {
  useEffect(() => {
    document.title = 'Help · UniVibe'
    return () => {
      document.title = 'UniVibe · Campus Events'
    }
  }, [])

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Help center</h1>
      <p className="mt-2 text-muted-foreground">Answers to common questions about booking, tickets and hosting events.</p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.title} href={`#${slug(s.title)}`} className="rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((s) => (
        <section key={s.title} id={slug(s.title)} className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-bold">{s.title}</h2>
          <div className="mt-3 divide-y rounded-xl border bg-card">
            {s.items.map((f) => (
              <details key={f.q} className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <Plus className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="mt-12 flex flex-col items-start gap-4 rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <MessageCircle className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-bold">Still need help?</p>
          <p className="text-sm text-muted-foreground">Send us a message and we’ll get back to you.</p>
        </div>
        <Button to="/contact">Contact us</Button>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        See also our <Link to="/terms" className="underline">terms</Link> and <Link to="/privacy" className="underline">privacy policy</Link>.
      </p>
    </div>
  )
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z]+/g, '-')
}
