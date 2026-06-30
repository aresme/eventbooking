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

def banner():
    print(Fore.RED + Style.BRIGHT + """
╔══════════════════════════════════════════════════════╗
║       UniVibe  —  Ticket Cancellation Tool  🗑️        ║
╚══════════════════════════════════════════════════════╝
""")

def cancel_by_ticket_code(db, code):
    bookings = db.collection('bookings').where('ticketCode', '==', code).get()
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
    batch = db.batch()
    cancelled_count = 0
    events_to_update = {}

    for b in bookings:
        data = b.to_dict()
        booking_id = b.id
        event_id = data.get('eventId')
        tier_id = data.get('tierId')

        print(Fore.CYAN + f"  Found Booking: {data.get('fullName')} | Code: {data.get('ticketCode')} | Event: {event_id}")

        # Delete the booking
        batch.delete(db.collection('bookings').document(booking_id))
        cancelled_count += 1

        # Track slots to restore
        if event_id and tier_id:
            if event_id not in events_to_update:
                events_to_update[event_id] = {}
            if tier_id not in events_to_update[event_id]:
                events_to_update[event_id][tier_id] = 0
            
            # Usually quantity is 1 per booking doc in this system
            events_to_update[event_id][tier_id] += 1 

    if cancelled_count == 0:
        return

    print(Fore.YELLOW + f"\n  Are you sure you want to completely cancel {cancelled_count} ticket(s)?")
    confirm = input("  Type 'yes' to confirm: ")
    if confirm.lower() != 'yes':
        print(Fore.GREEN + "  Cancellation aborted.")
        return

    print(Fore.CYAN + "\n  ⏳ Processing cancellations and freeing up slots...")
    
    # Restore slots in events
    for event_id, tiers_to_restore in events_to_update.items():
        event_ref = db.collection('events').document(event_id)
        event_doc = event_ref.get()
        if event_doc.exists:
            event_data = event_doc.to_dict()
            tiers = event_data.get('tiers', [])
            updated = False
            for tier in tiers:
                t_id = tier.get('id')
                if t_id in tiers_to_restore:
                    restored_amount = tiers_to_restore[t_id]
                    if tier['bookedSlots'] >= restored_amount:
                        tier['bookedSlots'] -= restored_amount
                    else:
                        tier['bookedSlots'] = 0
                    updated = True
            
            if updated:
                batch.update(event_ref, {'tiers': tiers})

    # Commit all changes atomically
    try:
        batch.commit()
        print(Fore.GREEN + Style.BRIGHT + f"\n  ✅ Successfully cancelled {cancelled_count} ticket(s) and restored event slots!")
    except Exception as e:
        print(Fore.RED + f"\n  ❌ Failed to cancel tickets: {e}")

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
