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
   eventbooking 2/tools/serviceAccountKey.json
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
