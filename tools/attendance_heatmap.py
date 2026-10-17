"""
attendance_heatmap.py
──────────────────────
Generates four charts from UniVibe Firestore booking data:

  Chart 1 — Bookings per Event (horizontal bar chart)
  Chart 2 — Bookings by Day of Week (bar chart)
  Chart 3 — Bookings by Hour of Day (line chart)
  Chart 4 — Bookings Over Time / Daily trend (line chart)

All charts are saved to  tools/charts/  and the full figure is shown on screen.

Usage:
    python attendance_heatmap.py             # show + save charts
    python attendance_heatmap.py --no-show   # save only, don't open window
"""

import sys
import os
import argparse
from collections import defaultdict, Counter
from datetime import datetime

try:
    import matplotlib
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    import matplotlib.gridspec as gridspec
    import pandas as pd
    import seaborn as sns
    from colorama import init, Fore, Style
    init(autoreset=True)
    from tabulate import tabulate
except ImportError:
    print("\nRun: pip install -r requirements.txt\n")
    sys.exit(1)

# Force UTF-8 for Windows terminal emoji printing
if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))
from univibe_firebase import get_db, fetch_collection, fetch_tickets

# ── Style config ─────────────────────────────────────────────────────────────
ACCENT      = "#FF4D6D"
ACCENT2     = "#FFB627"
SUCCESS     = "#00E676"
INFO        = "#29B6F6"
BG          = "#0F0F14"
CARD        = "#1A1A24"
FG          = "#E8E8F0"
MUTED       = "#9090A8"

plt.rcParams.update({
    "figure.facecolor":  BG,
    "axes.facecolor":    CARD,
    "axes.edgecolor":    "#2A2A3A",
    "axes.labelcolor":   FG,
    "xtick.color":       MUTED,
    "ytick.color":       MUTED,
    "text.color":        FG,
    "grid.color":        "#2A2A3A",
    "grid.linewidth":    0.8,
    "font.family":       "DejaVu Sans",
    "font.size":         11,
})

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
HOURS = [f"{h:02d}:00" for h in range(24)]


def banner():
    print(Fore.CYAN + Style.BRIGHT + """
╔══════════════════════════════════════════════════════╗
║       UniVibe  —  Attendance Heatmap  📊             ║
╚══════════════════════════════════════════════════════╝
""")


def fmt_date(iso_str):
    try:
        return datetime.fromisoformat(iso_str[:19]) if iso_str else None
    except Exception:
        return None


def run(show=True):
    banner()
    db = get_db()

    print("  ⏳  Fetching data from Firestore …")
    bookings = fetch_tickets(db)
    events   = fetch_collection(db, "events")
    print(f"  ✓  {len(bookings)} bookings  |  {len(events)} events\n")

    if not bookings:
        print(Fore.YELLOW + "  No bookings found — nothing to chart.\n")
        return

    # Build event lookup
    event_map = {e["id"]: e.get("title", "Unknown") for e in events}

    # Parse booking datetimes
    parsed = []
    for b in bookings:
        dt = fmt_date(b.get("bookedAt", ""))
        if dt:
            parsed.append({
                "dt":      dt,
                "eventId": b.get("eventId", ""),
                "event":   event_map.get(b.get("eventId", ""), "Deleted"),
                "phone":   b.get("phone", ""),
                "day":     dt.weekday(),        # 0=Mon
                "hour":    dt.hour,
                "date":    dt.date(),
            })

    if not parsed:
        print(Fore.YELLOW + "  No parseable booking timestamps found.\n")
        return

    df = pd.DataFrame(parsed)

    # ── Console preview ───────────────────────────────────────────────────────
    print(Fore.WHITE + Style.BRIGHT + "═" * 55)
    print("  📋  TOP EVENTS BY BOOKINGS")
    print("═" * 55)
    top_events = df.groupby("event").size().reset_index(name="bookings").sort_values("bookings", ascending=False).head(10)
    print(tabulate(top_events.values.tolist(), headers=["Event", "Bookings"], tablefmt="rounded_outline"))
    print()

    print(Fore.WHITE + Style.BRIGHT + "═" * 55)
    print("  📅  BOOKINGS BY DAY OF WEEK")
    print("═" * 55)
    day_counts = df.groupby("day").size().reindex(range(7), fill_value=0)
    day_table = [[DAYS[i], day_counts[i]] for i in range(7)]
    print(tabulate(day_table, headers=["Day", "Bookings"], tablefmt="rounded_outline"))
    print()

    # ── Output folder ─────────────────────────────────────────────────────────
    charts_dir = os.path.join(os.path.dirname(__file__), "charts")
    os.makedirs(charts_dir, exist_ok=True)

    # ── Build figure with 4 subplots ──────────────────────────────────────────
    fig = plt.figure(figsize=(18, 14), facecolor=BG)
    fig.suptitle("UniVibe — Attendance Analytics", fontsize=20, fontweight="bold",
                 color=FG, y=0.98)

    gs = gridspec.GridSpec(2, 2, figure=fig, hspace=0.45, wspace=0.35)

    # ── Chart 1: Bookings per Event ───────────────────────────────────────────
    ax1 = fig.add_subplot(gs[0, 0])
    ev_counts = df.groupby("event").size().sort_values(ascending=True).tail(12)
    colors1   = [ACCENT if v == ev_counts.max() else INFO for v in ev_counts.values]
    bars = ax1.barh(ev_counts.index, ev_counts.values, color=colors1, height=0.6)
    ax1.set_title("Bookings per Event", fontsize=13, fontweight="bold", color=FG, pad=10)
    ax1.set_xlabel("Number of Bookings", color=MUTED, fontsize=10)
    ax1.grid(axis="x", alpha=0.4)
    ax1.tick_params(axis="y", labelsize=9)
    # Add count labels
    for bar, val in zip(bars, ev_counts.values):
        ax1.text(val + 0.3, bar.get_y() + bar.get_height() / 2,
                 str(val), va="center", color=FG, fontsize=9, fontweight="bold")

    # ── Chart 2: Bookings by Day of Week ─────────────────────────────────────
    ax2 = fig.add_subplot(gs[0, 1])
    day_vals   = [df[df["day"] == i].shape[0] for i in range(7)]
    day_colors = [ACCENT2 if d == max(day_vals) else ACCENT for d in day_vals]
    bars2 = ax2.bar(DAYS, day_vals, color=day_colors, width=0.6)
    ax2.set_title("Bookings by Day of Week", fontsize=13, fontweight="bold", color=FG, pad=10)
    ax2.set_ylabel("Bookings", color=MUTED, fontsize=10)
    ax2.set_xticks(range(7))
    ax2.set_xticklabels([d[:3] for d in DAYS], fontsize=10)
    ax2.grid(axis="y", alpha=0.4)
    for bar, val in zip(bars2, day_vals):
        if val > 0:
            ax2.text(bar.get_x() + bar.get_width() / 2, val + 0.1,
                     str(val), ha="center", color=FG, fontsize=9, fontweight="bold")

    # ── Chart 3: Bookings by Hour of Day ─────────────────────────────────────
    ax3 = fig.add_subplot(gs[1, 0])
    hour_vals = [df[df["hour"] == h].shape[0] for h in range(24)]
    ax3.fill_between(range(24), hour_vals, alpha=0.25, color=SUCCESS)
    ax3.plot(range(24), hour_vals, color=SUCCESS, linewidth=2.5, marker="o",
             markersize=4, markerfacecolor=SUCCESS)
    peak_hour = hour_vals.index(max(hour_vals))
    ax3.axvline(x=peak_hour, color=ACCENT, linestyle="--", linewidth=1.5, alpha=0.7,
                label=f"Peak: {peak_hour:02d}:00")
    ax3.set_title("Bookings by Hour of Day", fontsize=13, fontweight="bold", color=FG, pad=10)
    ax3.set_xlabel("Hour", color=MUTED, fontsize=10)
    ax3.set_ylabel("Bookings", color=MUTED, fontsize=10)
    ax3.set_xticks(range(0, 24, 2))
    ax3.set_xticklabels([f"{h:02d}:00" for h in range(0, 24, 2)], fontsize=8, rotation=45)
    ax3.grid(alpha=0.35)
    ax3.legend(fontsize=9, facecolor=CARD, edgecolor="#2A2A3A", labelcolor=FG)

    # ── Chart 4: Daily Booking Trend ──────────────────────────────────────────
    ax4 = fig.add_subplot(gs[1, 1])
    daily = df.groupby("date").size().reset_index(name="count").sort_values("date")
    if len(daily) >= 2:
        # 7-day rolling average
        daily["rolling"] = daily["count"].rolling(window=min(7, len(daily)), min_periods=1).mean()
        ax4.fill_between(daily["date"], daily["count"], alpha=0.2, color=INFO)
        ax4.plot(daily["date"], daily["count"], color=INFO, linewidth=1.5,
                 alpha=0.7, label="Daily bookings")
        ax4.plot(daily["date"], daily["rolling"], color=ACCENT2, linewidth=2.5,
                 label="7-day avg")
        ax4.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
        ax4.xaxis.set_major_locator(mdates.AutoDateLocator())
        plt.setp(ax4.xaxis.get_majorticklabels(), rotation=40, ha="right", fontsize=9)
    else:
        # Not enough data for trend
        ax4.bar([str(r["date"]) for _, r in daily.iterrows()],
                daily["count"], color=INFO, width=0.5)
        ax4.set_xticks(range(len(daily)))
        ax4.set_xticklabels([str(r["date"]) for _, r in daily.iterrows()], rotation=30)
    ax4.set_title("Daily Booking Trend", fontsize=13, fontweight="bold", color=FG, pad=10)
    ax4.set_ylabel("Bookings", color=MUTED, fontsize=10)
    ax4.grid(alpha=0.35)
    ax4.legend(fontsize=9, facecolor=CARD, edgecolor="#2A2A3A", labelcolor=FG)

    # ── Save ──────────────────────────────────────────────────────────────────
    timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(charts_dir, f"attendance_heatmap_{timestamp}.png")
    fig.savefig(output_path, dpi=150, bbox_inches="tight", facecolor=BG)
    print(Fore.GREEN + f"  💾  Chart saved → {output_path}\n")

    if show:
        print(Fore.CYAN + "  Opening chart window …\n")
        plt.show()

    plt.close(fig)
    print(Fore.GREEN + "  ✅  Done!\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UniVibe Attendance Heatmap Generator")
    parser.add_argument("--no-show", action="store_true",
                        help="Save charts without opening a display window")
    args = parser.parse_args()
    run(show=not args.no_show)
