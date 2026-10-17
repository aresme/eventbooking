"""
migrate_v2.py
-------------
One-time migration of the live database from UniVibe v1 (old app) to v2 (React app).

  python migrate_v2.py --admin-email you@example.com            # dry run: shows what would change
  python migrate_v2.py --admin-email you@example.com --apply    # writes the changes

What it does:
  * users/{uid} for --admin-email gets role 'admin' (the account must already exist in Firebase Auth)
  * events: tiers list → map keyed by tier id; active → status; adds ownerId/featured/maxTickets
  * bookings: each old one-ticket booking becomes a v2 order (quantity 1, tickets[], ticketCodes[])
  * waitlists, activityLogs: add the owner/user fields the new rules need
  * --recount: recompute every tier's bookedSlots from confirmed bookings

Old bookings can still be opened by their ticket link (/tickets/<bookingId>), but won't appear
under "My tickets" because they weren't tied to a device.

Back up first:  gcloud firestore export gs://<bucket>/backup-before-v2
Run against the emulator by setting FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.
"""

import argparse
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

from univibe_firebase import get_db, fetch_collection

from firebase_admin import auth, firestore

PHONE = re.compile(r"^(\+254|254|0)?([17]\d{8})$")


def norm_phone(raw):
    m = PHONE.match(re.sub(r"[\s-]", "", str(raw or "")))
    return "0" + m.group(2) if m else str(raw or "")


def to_ts(value):
    if not value:
        return firestore.SERVER_TIMESTAMP
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return firestore.SERVER_TIMESTAMP
    return value


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--admin-email", required=True, help="Existing Firebase Auth email to make admin and owner of old events")
    ap.add_argument("--apply", action="store_true", help="Write changes (default is a dry run)")
    ap.add_argument("--recount", action="store_true", help="Recompute bookedSlots from confirmed bookings")
    args = ap.parse_args()

    db = get_db()
    try:
        admin = auth.get_user_by_email(args.admin_email)
    except auth.UserNotFoundError:
        sys.exit(f"No Firebase Auth user with email {args.admin_email}. Create it in the console first.")

    writes = []  # (ref, data, merge)

    writes.append((db.collection("users").document(admin.uid),
                   {"role": "admin", "email": admin.email, "displayName": admin.display_name or "Admin", "org": "UniVibe"}, True))

    # ---------- events ----------
    events = {e["id"]: e for e in fetch_collection(db, "events")}
    new_events = {}
    for eid, e in events.items():
        tiers = e.get("tiers") or {}
        if isinstance(tiers, list):
            tiers = {
                str(t.get("id") or f"t{i}"): {
                    "name": t.get("name", "General"),
                    "price": int(t.get("price") or 0),
                    "totalSlots": int(t.get("totalSlots") or 1),
                    "bookedSlots": int(t.get("bookedSlots") or 0),
                    "order": i,
                }
                for i, t in enumerate(tiers)
            }
        if not tiers:  # very old events had price/totalSlots on the event itself
            tiers = {"general": {"name": "General", "price": int(e.get("price") or 0), "totalSlots": int(e.get("totalSlots") or 100),
                                 "bookedSlots": int(e.get("bookedSlots") or 0), "order": 0}}
        allow = bool(e.get("allowMultiple"))
        data = {
            "tiers": tiers,
            "status": e.get("status") or ("published" if e.get("active", True) else "hidden"),
            "ownerId": e.get("ownerId") or admin.uid,
            "ownerName": e.get("ownerName") or "UniVibe",
            "featured": bool(e.get("featured")),
            "allowMultiple": allow,
            "maxTickets": max(1, min(20, int(e.get("maxTickets") or 5))) if allow else 1,
            "type": e.get("type") if e.get("type") in ("school", "normal") else "normal",
            "description": e.get("description", ""),
            "mapQuery": e.get("mapQuery", ""),
            "image": e.get("image", ""),
            "id": firestore.DELETE_FIELD,
            "active": firestore.DELETE_FIELD,
        }
        new_events[eid] = {**e, **data}
        writes.append((db.collection("events").document(eid), data, True))

    # ---------- bookings ----------
    counts = defaultdict(int)
    holders = defaultdict(int)
    migrated = 0
    for b in fetch_collection(db, "bookings"):
        ev = new_events.get(b.get("eventId"), {})
        tier = (ev.get("tiers") or {}).get(b.get("tierId"), {})
        if "tickets" in b:  # already v2
            if b.get("status") == "confirmed":
                counts[(b["eventId"], b["tierId"])] += b.get("quantity", 1)
            continue
        cancelled = bool(b.get("cancelled"))
        data = {
            "eventId": b.get("eventId", ""),
            "tierId": b.get("tierId", ""),
            "userId": "legacy",
            "ownerId": ev.get("ownerId", admin.uid),
            "eventTitle": ev.get("title", ""),
            "tierName": tier.get("name", ""),
            "unitPrice": int(tier.get("price") or 0),
            "fullName": b.get("fullName") or b.get("name") or "",
            "phone": norm_phone(b.get("phone")),
            "email": "",
            "regNumber": b.get("regNumber", ""),
            "school": b.get("school", ""),
            "quantity": 1,
            "tickets": [{"code": b.get("ticketCode", ""), "checkedIn": bool(b.get("checkedIn"))}],
            "ticketCodes": [b.get("ticketCode", "")],
            "status": "cancelled" if cancelled else "confirmed",
            "source": "legacy",
            "bookedAt": to_ts(b.get("bookedAt")),
        }
        writes.append((db.collection("bookings").document(b["id"]), data, False))
        migrated += 1
        if not cancelled:
            counts[(data["eventId"], data["tierId"])] += 1

    # ---------- waitlists ----------
    for w in fetch_collection(db, "waitlists"):
        ev = new_events.get(w.get("eventId"), {})
        writes.append((db.collection("waitlists").document(w["id"]), {
            "userId": w.get("userId", "legacy"),
            "ownerId": w.get("ownerId") or ev.get("ownerId", admin.uid),
            "eventTitle": ev.get("title", ""),
            "tierName": ((ev.get("tiers") or {}).get(w.get("tierId"), {})).get("name", ""),
            "phone": norm_phone(w.get("phone")),
            "email": w.get("email", ""),
            "joinedAt": to_ts(w.get("joinedAt")),
        }, True))

    # ---------- activity logs ----------
    for log in fetch_collection(db, "activityLogs"):
        if "createdAt" in log:
            continue
        ev = new_events.get(log.get("eventId"), {})
        writes.append((db.collection("activityLogs").document(log["id"]), {
            "ownerId": ev.get("ownerId", admin.uid),
            "actorId": "legacy",
            "actorName": "",
            "createdAt": to_ts(log.get("checkedInAt")),
        }, True))

    # ---------- recount ----------
    if args.recount:
        for eid, e in new_events.items():
            for tid, t in e["tiers"].items():
                n = counts.get((eid, tid), 0)
                if n != t["bookedSlots"]:
                    print(f"  recount {e.get('title')} / {t['name']}: {t['bookedSlots']} → {n}")
                    writes.append((db.collection("events").document(eid),
                                   {"tiers": {tid: {"bookedSlots": n, "totalSlots": max(t["totalSlots"], n)}}}, True))

    print(f"\n  {len(new_events)} events · {migrated} bookings to convert · {len(writes)} writes in total")
    print(f"  Admin: {admin.email} ({admin.uid})")

    if not args.apply:
        print("\n  Dry run only. Re-run with --apply to write these changes.\n")
        return

    batch, n = db.batch(), 0
    for ref, data, merge in writes:
        batch.set(ref, data, merge=merge)
        n += 1
        if n % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"\n  ✅ Migration complete ({n} writes).\n")


if __name__ == "__main__":
    main()
