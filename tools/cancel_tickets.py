import argparse
import sys
import os

try:
    from colorama import Fore, Style, init
    init(autoreset=True)
except ImportError:
    print("Run: pip install -r requirements.txt")
    sys.exit(1)

# Force UTF-8 for Windows terminal emoji printing
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))
from univibe_firebase import get_db
from firebase_admin import firestore

def banner():
    print(Fore.RED + Style.BRIGHT + """
╔══════════════════════════════════════════════════════╗
║       UniVibe  —  Ticket Cancellation Tool  🗑️        ║
╚══════════════════════════════════════════════════════╝
""")

def cancel_by_ticket_code(db, code):
    bookings = db.collection('bookings').where('ticketCodes', 'array_contains', code.upper()).get()
    if not bookings:
        print(Fore.YELLOW + f"  ⚠ No booking found with Ticket Code: {code}")
        return
    process_cancellations(db, bookings)

def cancel_by_phone(db, phone):
    bookings = db.collection('bookings').where('phone', '==', phone).get()
    if not bookings:
        print(Fore.YELLOW + f"  ⚠ No bookings found for Phone: {phone}")
        return
    process_cancellations(db, bookings)

def process_cancellations(db, bookings):
    """Mark bookings cancelled and give their seats back (same as cancelling in the dashboard)."""
    active = [b for b in bookings if b.to_dict().get('status') == 'confirmed']
    if not active:
        print(Fore.YELLOW + "  ⚠ All matching bookings are already cancelled.")
        return

    total = 0
    for b in active:
        d = b.to_dict()
        total += d.get('quantity', 1)
        print(Fore.CYAN + f"  Found: {d.get('fullName')} | {', '.join(d.get('ticketCodes', []))} | {d.get('eventTitle', d.get('eventId'))} × {d.get('quantity', 1)}")

    print(Fore.YELLOW + f"\n  Cancel {len(active)} booking(s) ({total} ticket(s))?")
    if input("  Type 'yes' to confirm: ").lower() != 'yes':
        print(Fore.GREEN + "  Cancellation aborted.")
        return

    for b in active:
        d = b.to_dict()
        qty = d.get('quantity', 1)

        @firestore.transactional
        def run(tx):
            event_ref = db.collection('events').document(d['eventId'])
            holder_ref = event_ref.collection('holders').document(d['userId'])
            event = event_ref.get(transaction=tx)
            holder = holder_ref.get(transaction=tx)
            tx.update(b.reference, {'status': 'cancelled'})
            if event.exists and d['tierId'] in (event.to_dict().get('tiers') or {}):
                booked = event.to_dict()['tiers'][d['tierId']].get('bookedSlots', 0)
                tx.update(event_ref, {f"tiers.{d['tierId']}.bookedSlots": max(0, booked - qty)})
            if holder.exists:
                tx.update(holder_ref, {'count': max(0, holder.to_dict().get('count', 0) - qty)})

        run(db.transaction())

    print(Fore.GREEN + Style.BRIGHT + f"\n  ✅ Cancelled {len(active)} booking(s) and released {total} seat(s).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fast ticket cancellation tool for UniVibe Admins")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--code", help="Cancel a specific ticket by its Ticket Code (e.g. UV-ABCDE)")
    group.add_argument("--phone", help="Cancel ALL tickets booked by a specific phone number")
    
    args = parser.parse_args()

    banner()
    db = get_db()
    if not db:
        sys.exit(1)

    if args.code:
        print(f"  🔍 Searching for Ticket Code: {args.code}...\n")
        cancel_by_ticket_code(db, args.code)
    elif args.phone:
        print(f"  🔍 Searching for all tickets under Phone: {args.phone}...\n")
        cancel_by_phone(db, args.phone)
