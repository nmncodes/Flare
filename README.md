# 🏎️ Flare — Formula 1 Head-to-Head Career Analytics

> **The ultimate 100% free, zero-API-key Formula 1 comparison engine built on Next.js.** Compare any two drivers in F1 history head-to-head with animated telemetry-style metrics, multi-axis performance radar charts, win conversion rates, and historical era benchmarks.

---

## 🌟 Key Features

* **⚔️ 1-Click Iconic Rivalries:** Instantly switch between legendary duels (*The GOAT Debate: Hamilton vs. Schumacher*, *Title Contenders: Verstappen vs. Norris*, *The McLaren War: Senna vs. Prost*, *Generational Titans: Alonso vs. Vettel*).
* **🕸️ 6-Axis Performance Radar:** Canvas-rendered, retina-ready spider chart comparing drivers across 6 core normalized dimensions (Championships, Race Wins, Pole Positions, Podium %, Win %, and Experience).
* **📊 Tale of the Tape:** Granular stat-by-stat breakdown (WDC Titles, Race Wins, Win Rate %, Poles, Podiums, Podium Rate %, Fastest Laps, Career Starts, and Points) with animated proportional progress bars and winner highlights.
* **⚡ Career Dominance Meter:** Real-time composite rating bar comparing overall career efficiency between Driver A and Driver B.
* **⏳ Era Overlap Benchmark:** Automatically detects whether two drivers shared the track as contemporaries or if it's a cross-era fantasy matchup.
* **🔍 Complete F1 Roster Access:** Curated Hall of Fame drivers + full search across all 850+ historical drivers in Formula 1 history via the open Jolpica F1 API.
* **📸 Official Driver Portraits & Bios:** Fetches high-resolution portraits and biographical context via Wikimedia REST API without any rate limits or keys.
* **🔗 Shareable Battle URLs:** Every matchup persists to the URL hash (e.g., `#hamilton-vs-max_verstappen`), making every duel linkable on social media.

---

## 🛠️ Tech Stack

* **Framework:** Next.js (App Router with Turbopack)
* **Frontend:** React Client Components + HTML5 2D Canvas
* **Styling:** Vanilla CSS design system with custom properties, neon glow, and dark mode
* **Data Sources:**
  * [Jolpica F1 API](https://api.jolpi.ca/ergast/f1/) — Ergast successor for historical stats
  * [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) — Driver portraits and biographies

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

---

## 📁 Project Architecture

```text
├── app/
│   ├── layout.js       # Root layout with fonts, metadata, and ambient glow effects
│   ├── page.js         # Interactive comparison arena controller
│   └── globals.css     # Global F1 dark mode design system & animations
├── components/
│   ├── DriverCard.js   # Dynamic driver card with portraits, teams, and quotes
│   ├── DominanceMeter.js # Real-time Career Dominance split meter & verdict
│   ├── TaleOfTheTape.js # Stat-by-stat proportional comparative rows
│   ├── RadarCanvas.js  # HTML5 Canvas 6-axis performance spider chart
│   ├── EraBenchmark.js # On-track contemporary vs fantasy era overlap detector
│   └── DriverModal.js  # Search modal (Curated + 850+ Historical Drivers)
├── data/
│   └── drivers.js      # Curated Hall of Fame benchmarks & iconic rivalries
├── lib/
│   └── api.js          # Jolpica F1 & Wikimedia integration with caching
└── package.json        # Next.js scripts and dependencies
```
