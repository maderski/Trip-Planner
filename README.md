# Trip Planner

A mobile-first trip planning app built with vanilla TypeScript and Vite. It can run fully locally, or use Firebase Hosting and Firestore for shared trip planning.

## Features

- **Multiple Trips** — Create and switch between trips from the sidebar selector.
- **Trip Details** — Set your destination, travel dates, cover photo, and map link. Countdown to departure.
- **Calendar** — Schedule events by day or date range. Attach photos, a location, and a map preview to each event.
- **Restaurants** — Track places to eat with meal type, cuisine, price range, address, website, and menu link. Mark as visited.
- **Accommodations** — Log hotels, Airbnbs, cabins, and campgrounds with check-in/out dates, address, booking link, and confirmation code.
- **Map Previews** — Paste any Google Maps or Apple Maps share link to get an embedded OpenStreetMap preview directly in the card.
- **Photos** — Attach photos to trips, events, restaurants, and accommodations. Tap to view full-screen.
- **Dark / Light theme** — Follows system preference; toggle in Settings.
- **Shared Workspace** — Use a passcode-backed workspace to collaborate on the same planner through Firebase.
- **Offline-ready** — Local storage remains available as a cache and fallback.

## Tech Stack

| Layer | Tool |
|-------|------|
| Language | TypeScript 5.9 |
| Build | Vite 7 |
| Maps | OpenStreetMap embed iframe |
| Storage | `localStorage` + Firestore sync |
| Styling | CSS custom properties, no framework |
| Deploy | Firebase Hosting |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

Copy `.env.example` to `.env.local` and fill in your Firebase web app config to enable shared sync.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run firebase:deploy` | Build and deploy to Firebase Hosting |
| `npm run firebase:emulators` | Start local Firebase emulators |

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

## Firebase Setup

1. Create a Firebase project and a web app.
2. Copy the web app config into `.env.local`.
3. Update `.firebaserc` with your Firebase project ID.
4. Deploy Firestore rules and Hosting with `npm run firebase:deploy`.

## Data

App data is stored locally under `trip-planner-data` and, when Firebase is configured, synced to Firestore as a shared passcode-backed workspace. You can still export a backup or import from a previous backup in **Settings**.
