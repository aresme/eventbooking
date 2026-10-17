<h1 align="center">⚡ UniVibe · Campus Event Booking</h1>

<p align="center">
  <strong>Discover, book and attend university events. QR tickets on your phone.</strong><br>
  React + Firebase web app with organizer accounts, waitlists, door check-in and email tickets.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Firebase-Spark_plan-orange?logo=firebase" alt="Firebase">
  <img src="https://img.shields.io/badge/PWA-installable-blue" alt="PWA">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

---

## Features

**Attendees** (no account needed)
- Browse and search events; filter by this week, trending, school, open or free
- Pick a ticket type and quantity, then book in two steps
- QR ticket with its own link: save it as an image, share on WhatsApp, add to Google, Outlook or Apple Calendar
- **My tickets**: every booking made on this device; cancel your own booking before the event
- Waitlist for sold-out ticket types
- Optional email confirmation (EmailJS)
- Dark mode, installable as an app (PWA), works on bad connections

**Organizers & admins** (separate admin page: `/admin`, built from `admin.html`)
- **Roles:** clubs apply as organizers and an admin approves them. Organizers see and manage only their own events.
- Events need admin approval before going public; admins can feature events on the home page
- Event editor with multiple ticket types, per-person limits, Cloudinary upload, Unsplash search and an AI-written description
- Bookings table with search, filters and CSV export
- Waitlist: give freed seats to the person who waited longest (they're emailed their ticket)
- **Check-in** with the phone camera or by typing a code, plus a live "inside" counter
- Overview charts, activity log, promo QR codes for posters

**Security**
- Visitors sign in anonymously, so bookings belong to a device and nobody can read other people's bookings
- Bookings are transactions; [`firestore.rules`](firestore.rules) check capacity, price and per-person limits on the server, so there's no overbooking and no tampering from the browser console
- 34 automated tests cover the rules and the booking flow ([`tests/`](tests))

---

## Quick start (local, no Firebase project needed)

Requires **Node.js 22+** and **Java 11+** (for the Firebase emulators).

```bash
npm install
npm run emulators          # terminal 1: local Auth + Firestore (UI at http://localhost:4000)
npm run seed               # terminal 2: demo events, bookings and accounts
npm run dev:emulator       # terminal 2: app at http://localhost:5173
```

Demo logins for `/admin`: `admin@univibe.test` and `organizer@univibe.test`, both with password `password123`.

## Connecting to your Firebase project

1. Firebase Console:
   - **Authentication → Sign-in method**: enable **Anonymous** and **Email/Password**.
   - **Project settings → Your apps**: copy the web app config.
2. `cp .env.example .env` and fill in the `VITE_FIREBASE_*` values.
3. Deploy the rules and indexes: `npx firebase deploy --only firestore`
4. Make yourself the first admin: create your account in **Authentication → Users**, then:
   ```bash
   cd tools && pip install -r requirements.txt   # needs serviceAccountKey.json, see tools/README.md
   python set_role.py you@example.com admin
   ```
5. `npm run dev` to run against the real project.

### Upgrading from v1 (the old HTML/JS app)

v2 stores ticket types and bookings differently. Back up Firestore, then run:

```bash
cd tools
python migrate_v2.py --admin-email you@example.com            # dry run
python migrate_v2.py --admin-email you@example.com --apply    # convert the data
```

Old tickets keep working through their ticket links and at the door scanner.

## Deploy

```bash
npm run build
npx firebase deploy --only hosting,firestore
```

## Optional integrations (`.env`)

| Variable | What it enables |
|---|---|
| `VITE_EMAILJS_*` | Ticket emails and "you got a seat" emails. [EmailJS](https://www.emailjs.com) free plan: 200 emails/month. Template variables: `to_name`, `event_title`, `event_date`, `event_time`, `event_venue`, `tier_name`, `quantity`, `total`, `ticket_codes`, `ticket_url` |
| `VITE_UNSPLASH_ACCESS_KEY` | Cover image search in the event editor |
| `VITE_GEMINI_API_KEY` | "Write with AI" event descriptions. **Restrict the key to your domain** in Google Cloud. |

Cloudinary upload and social links are set by an admin in **Dashboard → Settings**.

---

## Project structure

```
├── index.html              # public site
├── admin.html              # admin page (/admin)
├── src/
│   ├── App.jsx             # routes
│   ├── lib/                # firebase init, formatting, calendar helpers
│   ├── services/           # all Firestore access: events, bookings, waitlist, users, settings, email
│   ├── hooks/              # useAuth (anonymous + staff roles), useSubscription, useTheme
│   ├── components/         # EventCard, TicketCard, SiteLayout, ui/ (buttons, dialogs, forms)
│   └── pages/
│       ├── public/         # Home, EventDetail, Ticket, MyTickets, Terms/Privacy
│       └── public/…
│   └── admin/              # separate admin page (admin.html): AdminApp + pages/
├── firestore.rules         # the security model, see comments inside
├── firestore.indexes.json
├── tests/                  # rules + service tests (npm run test:rules)
├── scripts/seed-emulator.mjs
└── tools/                  # Python admin tools: migration, roles, duplicates, charts, cancellation
```

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server against the Firebase project in `.env` |
| `npm run dev:emulator` | Dev server against local emulators |
| `npm run emulators` / `npm run seed` | Start emulators / load demo data |
| `npm run test:rules` | Run the 34 rules and booking tests in the emulator |
| `npm run build` / `npm run preview` | Production build / preview it |

## Tech stack

React 19 · React Router 7 · Vite 8 · Tailwind CSS 4 · Firebase 13 (Auth, Firestore) · Recharts · html5-qrcode · qrcode.react · EmailJS · vite-plugin-pwa

## License

MIT © [aresme](https://github.com/aresme)
