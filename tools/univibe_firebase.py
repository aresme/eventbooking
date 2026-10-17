"""
univibe_firebase.py
-------------------
Shared Firebase/Firestore connection helper for all UniVibe Python tools.
"""

import os
import json
import sys

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("\n[ERROR] firebase-admin is not installed.")
    print("  Run:  pip install -r requirements.txt\n")
    sys.exit(1)

# ── Path to service account key ──────────────────────────────────────────────
# Place your downloaded service account JSON here, OR set an env variable:
#   set UNIVIBE_SA_KEY=C:\path\to\your-key.json
_DEFAULT_KEY_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
_SA_KEY_PATH = os.environ.get("UNIVIBE_SA_KEY", _DEFAULT_KEY_PATH)

_app = None  # singleton


def get_db():
    """Return an initialised Firestore client (singleton)."""
    global _app
    if _app is not None:
        return firestore.client()

    # Local emulators (FIRESTORE_EMULATOR_HOST=127.0.0.1:8080): no key needed.
    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        project = os.environ.get("GCLOUD_PROJECT", "demo-univibe")
        from google.auth.credentials import AnonymousCredentials

        class _EmulatorCredential(credentials.Base):
            def get_credential(self):
                return AnonymousCredentials()

        _app = firebase_admin.initialize_app(_EmulatorCredential(), options={"projectId": project})
        print(f"  ✓  Connected to Firestore emulator ({project})\n")
        return firestore.client()

    if not os.path.exists(_SA_KEY_PATH):
        print("\n" + "═" * 60)
        print("  ⚠  SERVICE ACCOUNT KEY NOT FOUND")
        print("═" * 60)
        print(f"  Expected path: {_SA_KEY_PATH}")
        print()
        print("  HOW TO GET YOUR KEY:")
        print("  1. Go to Firebase Console → Project Settings")
        print("     https://console.firebase.google.com/project/univibe-events-9c77f/settings/serviceaccounts/adminsdk")
        print("  2. Click 'Generate new private key'")
        print("  3. Save the downloaded JSON file as:")
        print(f"     {_SA_KEY_PATH}")
        print()
        print("  OR set an environment variable:")
        print("     set UNIVIBE_SA_KEY=C:\\path\\to\\your-key.json")
        print("═" * 60 + "\n")
        sys.exit(1)

    try:
        cred = credentials.Certificate(_SA_KEY_PATH)
        _app = firebase_admin.initialize_app(cred)
        print(f"  ✓  Connected to Firestore (univibe-events-9c77f)\n")
        return firestore.client()
    except Exception as e:
        print(f"\n[ERROR] Failed to connect to Firebase: {e}\n")
        sys.exit(1)


def fetch_collection(db, name):
    """Fetch all documents from a Firestore collection as a list of dicts."""
    docs = db.collection(name).stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


def _iso(value):
    """Firestore timestamps → ISO string (older data already stored ISO strings)."""
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def fetch_tickets(db):
    """
    One dict per ticket, in the shape the analytics tools expect:
    ticketCode, fullName, phone, eventId, tierId, bookedAt (ISO), cancelled, checkedIn.

    v2 bookings are orders holding several tickets; v1 (legacy) bookings were one ticket each.
    """
    rows = []
    for b in fetch_collection(db, "bookings"):
        base = {
            "bookingId": b["id"],
            "eventId": b.get("eventId", ""),
            "tierId": b.get("tierId", ""),
            "fullName": b.get("fullName", ""),
            "phone": b.get("phone", ""),
            "bookedAt": _iso(b.get("bookedAt")),
            "cancelled": b.get("status") == "cancelled" or bool(b.get("cancelled")),
        }
        tickets = b.get("tickets")
        if tickets:
            for t in tickets:
                rows.append({**base, "ticketCode": t.get("code", ""), "checkedIn": bool(t.get("checkedIn"))})
        else:
            rows.append({**base, "ticketCode": b.get("ticketCode", ""), "checkedIn": bool(b.get("checkedIn"))})
    return rows
