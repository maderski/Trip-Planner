# Trip Planner

A mobile-first trip planning app built with vanilla TypeScript and Vite. Everything is stored locally in the browser — no account, no backend, no tracking.

## Features

- **Trip Details** — Set your destination, travel dates, cover photo, and map link. Countdown to departure.
- **Calendar** — Schedule events by day or date range. Attach photos, a location, and a map preview to each event.
- **Restaurants** — Track places to eat with meal type, cuisine, price range, address, website, and menu link. Mark as visited.
- **Accommodations** — Log hotels, Airbnbs, cabins, and campgrounds with check-in/out dates, address, booking link, and confirmation code.
- **Map Previews** — Paste any Google Maps or Apple Maps share link to get an embedded OpenStreetMap preview directly in the card.
- **Photos** — Attach photos to trips, events, restaurants, and accommodations. Tap to view full-screen.
- **Dark / Light theme** — Follows system preference; toggle in Settings.
- **Offline-ready** — All data lives in `localStorage`. No internet required after first load.

## Tech Stack

| Layer | Tool |
|-------|------|
| Language | TypeScript 5.9 |
| Build | Vite 7 |
| Maps | OpenStreetMap embed iframe |
| Storage | `localStorage` (no backend) |
| Styling | CSS custom properties, no framework |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |

## Project Structure

```
src/
├── trip/              # Trip details, hero, cover photo
├── calendar/          # Calendar grid, events
├── restaurants/       # Restaurant cards and form
├── accommodations/    # Stay cards and form
├── settings/          # Theme toggle, data import/export
├── auth/              # Auth module
└── shared/
    ├── components/    # Modal, card base styles
    ├── styles/        # CSS variables, reset, global styles
    └── utils/         # Maps, photos, icons, dates, storage
```

## Data

All app data is stored as a single JSON object in `localStorage` under the key `trip-planner-data`. You can export a backup or import from a previous backup in **Settings**.
