
<h1 align="center">⚡ UniVibe — Campus Event Booking</h1>

<p align="center">
  <strong>Discover, book, and attend the best university events — instantly.</strong><br>
  A full-stack Firebase web app with QR tickets, admin panel, waitlists, and analytics tools.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Firebase-10.7.1-orange?logo=firebase" alt="Firebase">
  <img src="https://img.shields.io/badge/PWA-Enabled-blue?logo=googlechrome" alt="PWA">
  <img src="https://img.shields.io/badge/Gemini_AI-Powered-purple?logo=google" alt="Gemini AI">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

---

## ✨ Features

### 👤 User-Facing
| Feature | Description |
|---|---|
| 🔍 **Browse Events** | Filter events by category, date, or search by keyword |
| 🎟️ **Instant Booking** | Book tickets with name + phone — no account required |
| 📱 **Digital Ticket + QR** | Auto-generated QR code ticket, shareable & downloadable |
| ⏳ **Waitlist** | Join a waitlist when an event is sold out — auto-notified when a spot opens |
| 🌙 **Dark / Light Mode** | Smooth theme toggle saved to localStorage |
| 📲 **PWA (Installable)** | Install as a native-like app on Android, iOS, and desktop |
| 🧠 **AI Event Description** | Gemini AI auto-generates professional event descriptions |
| 🔗 **Deep Links** | Direct shareable URLs to any event (`#event-ID`) |

### 🛠️ Admin Panel (`admin.html`)
| Feature | Description |
|---|---|
| 📊 **Live Dashboard** | Real-time stats: total events, bookings today, revenue, active waitlists |
| ➕ **Create / Edit Events** | Rich event form: title, date, venue, capacity, price, cover image (Cloudinary/Unsplash) |
| 📋 **Booking Management** | View all bookings per event, search by name or phone |
| ✅ **QR Ticket Scanner** | Camera-based QR scanner to validate tickets at the door |
| 🗑️ **Bulk Delete** | Select and delete multiple events at once |
| 📤 **Export Bookings** | Download booking list as CSV for any event |
| 📝 **Activity Log** | Audit trail of admin actions |
| 🌐 **Social Links** | Configure Facebook, Instagram, Twitter links |

### 🐍 Python Analytics Tools (`tools/`)
| Tool | Description |
|---|---|
| `duplicate_detector.py` | Finds phone numbers that booked the same event more than once (fraud detection) |
| `attendance_heatmap.py` | Generates 4 charts: bookings per event, by day, by hour, and daily trend |

---

## 🚀 Getting Started

### Prerequisites
- A [Firebase](https://firebase.google.com) project with **Firestore** enabled
- A web server (or just open `index.html` directly in a browser for local dev)

### 1. Clone the repo
```bash
git clone https://github.com/aresme/eventbooking.git
cd eventbooking
```

### 2. Configure your secrets
```bash
cp firebase-config.example.js firebase-config.js
```
Open `firebase-config.js` and fill in your Firebase project credentials:
```js
window.APP_CONFIG = {
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    // ... etc
  },
  unsplashAccessKey: "YOUR_UNSPLASH_KEY",  // optional — for cover image search
  geminiApiKey: "YOUR_GEMINI_KEY"           // optional — for AI descriptions
};
```
> ⚠️ `firebase-config.js` is gitignored — **never commit it**.

### 3. Set up Firestore Security Rules
Deploy the included rules to protect your database:
```bash
firebase deploy --only firestore:rules
```

### 4. Open the app
Simply open `index.html` in a browser, or deploy to Firebase Hosting:
```bash
firebase deploy --only hosting
```

---

## 📁 Project Structure

```
eventbooking/
├── index.html                  # Main user-facing app
├── admin.html                  # Admin dashboard
├── app.js                      # All app logic (~3000 lines)
├── style.css                   # Global styles
├── sw.js                       # Service worker (PWA)
├── manifest.json               # PWA manifest
├── firebase.json               # Firebase Hosting config
├── firestore.rules             # Firestore security rules
├── firebase-config.example.js  # ✅ Committed — safe template
├── firebase-config.js          # ❌ Gitignored — your real secrets
├── screenshots/                # App screenshots for README
└── tools/                      # Python analytics scripts
    ├── duplicate_detector.py
    ├── attendance_heatmap.py
    ├── univibe_firebase.py      # Shared Firestore connection
    ├── requirements.txt
    └── README.md               # Tools-specific documentation
```

---

## 🐍 Python Analytics Tools Setup

```bash
cd tools
pip install -r requirements.txt
```

Then download your Firebase Service Account Key:
1. Go to [Firebase Console → Project Settings → Service Accounts](https://console.firebase.google.com)
2. Click **"Generate new private key"**
3. Save as `tools/serviceAccountKey.json`

> ⚠️ `serviceAccountKey.json` is gitignored — **never commit it**.

### Run the tools
```bash
# Detect duplicate bookings (fraud detection)
python duplicate_detector.py

# Generate attendance analytics charts
python attendance_heatmap.py
```

See [`tools/README.md`](tools/README.md) for full documentation.

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vanilla HTML, CSS, JavaScript |
| **Styling** | TailwindCSS (CDN) + custom CSS variables |
| **Database** | Firebase Firestore (real-time) |
| **Hosting** | Firebase Hosting |
| **Image Upload** | Cloudinary |
| **Image Search** | Unsplash API |
| **AI** | Google Gemini API (event descriptions) |
| **QR Scanning** | `html5-qrcode` library |
| **PDF Tickets** | `html2canvas` |
| **Analytics** | Firebase Analytics |
| **PWA** | Service Worker + Web App Manifest |
| **Python Tools** | `firebase-admin`, `pandas`, `matplotlib` |

---

## 🔐 Security

- **Firestore Rules** enforce that only authenticated admins can write events; reads are public.
- **XSS Protection** — all user-supplied strings are escaped through a dedicated `esc()` helper before rendering.
- **Secrets** are loaded at runtime from a gitignored `firebase-config.js` file — no secrets in source code.
- **Push Protection** — GitHub's secret scanning is respected; no API keys are committed.

---

## 🌐 Live Demo

> 🔗 **[univibe-events-9c77f.web.app](https://univibe-events-9c77f.web.app)**

---

## 📄 License

MIT © [aresme](https://github.com/aresme)
