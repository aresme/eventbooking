"""
duplicate_detector.py
─────────────────────
Scans all UniVibe bookings and identifies phone numbers that appear more than
once across the whole platform or on the same event/tier.

Usage:
    python duplicate_detector.py             # full report
    python duplicate_detector.py --export    # also saves duplicates.csv
"""

import sys
import os
import argparse
from collections import defaultdict
from datetime import datetime

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    from tabulate import tabulate
except ImportError:
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

# Force UTF-8 for Windows terminal emoji printing
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))
from univibe_firebase import get_db, fetch_collection

# ─────────────────────────────────────────────────────────────────────────────

def banner():
    print(Fore.CYAN + Style.BRIGHT + """
╔══════════════════════════════════════════════════════╗
║       UniVibe  —  Duplicate Phone Detector  🔍       ║
╚══════════════════════════════════════════════════════╝
""")

def fmt_date(iso_str):
    if not iso_str:
        return "—"
    try:
        return datetime.fromisoformat(iso_str[:19]).strftime("%d %b %Y %H:%M")
    except Exception:
        return iso_str[:16]


def run(export_csv=False):
    banner()
    db = get_db()

    print("  ⏳  Fetching data from Firestore …")
    bookings = fetch_collection(db, "bookings")
    events   = fetch_collection(db, "events")
    print(f"  ✓  {len(bookings)} bookings  |  {len(events)} events\n")

    if not bookings:
        print(Fore.YELLOW + "  No bookings found.\n")
        return

    # Build event lookup
    event_map = {e["id"]: e.get("title", "Unknown Event") for e in events}

    # ── 1. Global duplicates: same phone → multiple bookings ─────────────────
    phone_to_bookings = defaultdict(list)
    for b in bookings:
        phone = b.get("phone", "").strip()
        if phone:
            phone_to_bookings[phone].append(b)

    duplicates = {ph: bks for ph, bks in phone_to_bookings.items() if len(bks) > 1}

    print(Fore.WHITE + Style.BRIGHT + "═" * 60)
    print(f"  📋  GLOBAL DUPLICATES  (same phone, any event)")
    print("═" * 60)

    if not duplicates:
        print(Fore.GREEN + "  ✅  No global duplicates found — all phones are unique!\n")
    else:
        print(Fore.RED + f"  ⚠   {len(duplicates)} phone number(s) have multiple bookings:\n")
        rows = []
        for phone, bks in sorted(duplicates.items(), key=lambda x: -len(x[1])):
            for bk in sorted(bks, key=lambda b: b.get("bookedAt", "")):
                rows.append([
                    phone,
                    len(bks),
                    bk.get("fullName", "—"),
                    bk.get("ticketCode", "—"),
                    event_map.get(bk.get("eventId", ""), "Deleted"),
                    fmt_date(bk.get("bookedAt", "")),
                    "✓" if bk.get("cancelled") else "",
                ])
        headers = ["Phone", "# Bookings", "Name", "Ticket Code", "Event", "Booked At", "Cancelled"]
        print(tabulate(rows, headers=headers, tablefmt="rounded_outline"))
        print()

    # ── 2. Same-event duplicates: same phone → same event (worst case) ───────
    event_phone = defaultdict(lambda: defaultdict(list))  # eventId → phone → [bookings]
    for b in bookings:
        if not b.get("cancelled"):
            phone   = b.get("phone", "").strip()
            eventId = b.get("eventId", "")
            if phone and eventId:
                event_phone[eventId][phone].append(b)

    print(Fore.WHITE + Style.BRIGHT + "═" * 60)
    print(f"  🎟   SAME-EVENT DUPLICATES  (same phone, same event)")
    print("═" * 60)

    same_event_dupes = []
    for eventId, phones in event_phone.items():
        for phone, bks in phones.items():
            if len(bks) > 1:
                for bk in bks:
                    same_event_dupes.append({
                        "phone": phone,
                        "name": bk.get("fullName", "—"),
                        "event": event_map.get(eventId, "Deleted"),
                        "ticket": bk.get("ticketCode", "—"),
                        "booked_at": fmt_date(bk.get("bookedAt", "")),
                        "count": len(bks),
                    })

    if not same_event_dupes:
        print(Fore.GREEN + "  ✅  No same-event duplicates found!\n")
    else:
        print(Fore.RED + f"  ⚠   {len(set(d['phone'] for d in same_event_dupes))} phone(s) booked the same event more than once:\n")
        rows = [[d["phone"], d["count"], d["name"], d["event"], d["ticket"], d["booked_at"]]
                for d in same_event_dupes]
        headers = ["Phone", "# Tickets", "Name", "Event", "Ticket Code", "Booked At"]
        print(tabulate(rows, headers=headers, tablefmt="rounded_outline"))
        print()

    # ── 3. Summary ────────────────────────────────────────────────────────────
    total_dup_phones     = len(duplicates)
    total_same_ev_phones = len(set(d["phone"] for d in same_event_dupes))
    clean_phones         = len(phone_to_bookings) - total_dup_phones

    print(Fore.WHITE + Style.BRIGHT + "═" * 60)
    print("  📊  SUMMARY")
    print("═" * 60)
    summary = [
        ["Total unique phones",            len(phone_to_bookings)],
        ["Clean (1 booking only)",          clean_phones],
        ["Phones with multiple bookings",   total_dup_phones],
        ["Phones with same-event dupes",    total_same_ev_phones],
        ["Total bookings scanned",          len(bookings)],
    ]
    print(tabulate(summary, tablefmt="simple"))
    print()

    # ── 4. CSV Export ─────────────────────────────────────────────────────────
    if export_csv and duplicates:
        try:
            import csv
            out_path = os.path.join(os.path.dirname(__file__), "duplicates_report.csv")
            with open(out_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["Phone", "Booking Count", "Name", "Ticket Code",
                                 "Event", "Booked At", "Cancelled"])
                for phone, bks in duplicates.items():
                    for bk in bks:
                        writer.writerow([
                            phone, len(bks),
                            bk.get("fullName", ""),
                            bk.get("ticketCode", ""),
                            event_map.get(bk.get("eventId", ""), "Deleted"),
                            bk.get("bookedAt", ""),
                            "Yes" if bk.get("cancelled") else "No",
                        ])
            print(Fore.GREEN + f"  💾  Report saved → {out_path}\n")
        except Exception as e:
            print(Fore.RED + f"  CSV export failed: {e}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UniVibe Duplicate Phone Detector")
    parser.add_argument("--export", action="store_true", help="Save results to duplicates_report.csv")
    args = parser.parse_args()
    run(export_csv=args.export)
