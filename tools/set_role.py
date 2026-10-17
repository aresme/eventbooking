"""
set_role.py — give an existing Firebase Auth account a dashboard role.

  python set_role.py you@example.com admin
  python set_role.py club@example.com organizer

Use it once to create the first admin; after that, admins approve organizers in the dashboard.
"""

import sys

from univibe_firebase import get_db
from firebase_admin import auth

ROLES = ("admin", "organizer", "pending", "revoked")

if len(sys.argv) != 3 or sys.argv[2] not in ROLES:
    sys.exit(f"Usage: python set_role.py <email> <{'|'.join(ROLES)}>")

email, role = sys.argv[1], sys.argv[2]
db = get_db()
try:
    user = auth.get_user_by_email(email)
except auth.UserNotFoundError:
    sys.exit(f"No Firebase Auth user with email {email}. Create it in Firebase Console → Authentication first.")

db.collection("users").document(user.uid).set(
    {"role": role, "email": email, "displayName": user.display_name or email.split("@")[0]}, merge=True
)
print(f"  ✅ {email} is now '{role}'.")
