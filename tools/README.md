# UniVibe Python Tools 🐍

Local analytics scripts that connect directly to your Firestore database.

---

## 📦 Setup (one time only)

### Step 1 — Install dependencies
```bash
cd tools
pip install -r requirements.txt
```

### Step 2 — Get your Firebase Service Account Key
1. Open → https://console.firebase.google.com/project/univibe-events-9c77f/settings/serviceaccounts/adminsdk
2. Click **"Generate new private key"**
3. Save the downloaded `.json` file as:
   ```
   tools/serviceAccountKey.json
   ```

> ⚠️ **Never commit `serviceAccountKey.json` to Git.** It is already in `.gitignore`.

---

## 🔍 Tool 1 — Duplicate Phone Detector

Scans all bookings and finds phone numbers that appear more than once.

```bash
# Show report in terminal
python duplicate_detector.py

# Save results to CSV file as well
python duplicate_detector.py --export
```

**What it checks:**
- ✅ Same phone used across **any** events (global duplicates)
- ✅ Same phone used for the **same event** (worst case fraud)
- ✅ Summary counts

**Output files:** `tools/duplicates_report.csv` (when `--export` is used)

---

## 📊 Tool 2 — Attendance Heatmap

Generates 4 charts from booking data and saves them as PNG images.

```bash
# Generate and open charts
python attendance_heatmap.py

# Save only, no window
python attendance_heatmap.py --no-show
```

**Charts generated:**
1. **Bookings per Event** — horizontal bar chart of top events
2. **Bookings by Day of Week** — which day gets the most bookings
3. **Bookings by Hour of Day** — peak booking times
4. **Daily Booking Trend** — bookings over time with 7-day rolling average

**Output files:** `tools/charts/attendance_heatmap_YYYYMMDD_HHMMSS.png`

---

## 📁 Folder Structure

```
tools/
├── requirements.txt          # Python dependencies
├── univibe_firebase.py       # Shared Firestore connection (don't run directly)
├── duplicate_detector.py     # Tool 1
├── attendance_heatmap.py     # Tool 2
├── serviceAccountKey.json    # ← YOU ADD THIS (not in Git)
├── charts/                   # Auto-created — saved chart images
└── duplicates_report.csv     # Auto-created by --export flag
```

---

## ❓ Troubleshooting

| Error | Fix |
|---|---|
| `serviceAccountKey.json not found` | Follow Step 2 above |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| `PERMISSION_DENIED` | Your key file may be wrong or corrupted — re-download |
| Charts don't open | Run with `--no-show` and open the PNG from `charts/` manually |

---

## 🛠 Admin tools (v2)

### Make someone an admin or organizer
```bash
python set_role.py you@example.com admin
python set_role.py club@example.com organizer
```
The account must already exist in Firebase Console → Authentication. Use this once for the first admin; after that, approve organizers in **Dashboard → Organizers**.

### Migrate data from the old app (v1 → v2)
```bash
python migrate_v2.py --admin-email you@example.com            # dry run, changes nothing
python migrate_v2.py --admin-email you@example.com --apply    # convert
python migrate_v2.py --admin-email you@example.com --apply --recount   # also recompute seat counts from bookings
```
Back up Firestore first. Old tickets keep working through their links and at the scanner.

### Cancel tickets in bulk
```bash
python cancel_tickets.py --code UV-AB12CD
python cancel_tickets.py --phone 0712345678
```
Marks the bookings cancelled and gives their seats back, the same as cancelling in the dashboard.

### Run any tool against the local emulators
```bash
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-univibe
python duplicate_detector.py
```
No service account key is needed in emulator mode.
