# UniVibe v2 Roadmap

Decisions:
- **Firebase Spark (free) plan**, so no Cloud Functions. Security is enforced by `firestore.rules` and client transactions.
- **Full UI rewrite:** React 19 + Vite 8 + Tailwind 4 + React Router 7 (JavaScript).
- **Notifications:** email only (EmailJS free tier, 200/month). SMS is postponed (it needs a server to hold the API key).

---

## ✅ Done (branch `revamp`)

### Fixes from v1
- [x] **Booking privacy:** visitors sign in anonymously; bookings are readable only by their owner, the event's organizer and admins.
- [x] **Overbooking:** bookings are transactions; the rules check `bookedSlots` changes by exactly the booking's quantity and never exceed capacity.
- [x] **Event tampering:** only the owning organizer or an admin can edit events; visitors can only move seat counters, and only as part of a booking or a cancel.
- [x] Per-person ticket limit enforced on the server (`events/{id}/holders/{uid}`).
- [x] Customer "Cancel" button works (old duplicate `cancelBooking` bug).
- [x] Admin page crash (missing config): config now comes from `.env`.
- [x] Social links and Cloudinary settings stored in Firestore `settings/public`, not localStorage.
- [x] Offline cache uses hashed build files (vite-plugin-pwa); staff-only code isn't precached.
- [x] QR codes generated in the browser (no third-party QR API).
- [x] `clear_data.js` removed.

### New
- [x] Organizer roles: sign-up → admin approval → manage own events; admins approve and feature events.
- [x] Email confirmations and waitlist-promotion emails (EmailJS, optional).
- [x] Shareable pages: `/events/:id`, `/tickets/:bookingId`, `/my-tickets`, `/dashboard/*`.
- [x] Multi-ticket bookings with one QR per ticket; staff cancel; waitlist promotion; camera check-in with a live counter.
- [x] Dashboard overview chart, CSV export, activity log, promo QR codes.
- [x] Dark mode, mobile bottom-sheet dialogs, skeleton loading, empty states.

### Tooling
- [x] 34 tests: `firestore.rules` and the real booking services in the emulator (`npm run test:rules`).
- [x] Local demo: `npm run emulators`, `npm run seed`, `npm run dev:emulator`.
- [x] `tools/migrate_v2.py` (tested on v1-format data), `tools/set_role.py`; Python tools read the new format.

---

## ⏭ Going live (needs your Firebase console)
1. Enable **Anonymous** + **Email/Password** sign-in.
2. Fill `.env` from `.env.example`.
3. Back up Firestore, then `python tools/migrate_v2.py --admin-email … --apply`.
4. `npx firebase deploy --only firestore,hosting`.
5. Optional: EmailJS account and templates; restrict the Gemini key to your domain.

## 💡 Later ideas
- SMS notifications (needs Blaze plan or a small serverless endpoint)
- M-Pesa payments (STK push, also needs a server)
- "Save my tickets to an account" (link the anonymous user to Google sign-in)
- Event reminders the day before (needs scheduled jobs, so server-side)
