# Pocket Pace

Pocket Pace is a private, mobile-first personal fitness tracker built for an iPhone. It is a static React PWA designed to run on GitHub Pages without accounts, a server, or a cloud database.

All personal fitness data is stored locally in the browser's IndexedDB database.

## Current status

All planned phases are complete: a production-ready React/TypeScript/Tailwind PWA with versioned Dexie storage, GitHub Pages deployment, a mobile application shell, workouts, nutrition, progress, backups, USDA food search, and barcode scanning.

## Features

- Workout library, reusable templates, weekly scheduling, recovery-safe active sessions, set/reps/weight/RIR logging, rest timers, previous-performance context, and history.
- Bodyweight logs, trailing 7-entry average, 1/3/6-month charts, exercise strength history, estimated 1RM, volume, and personal-record indicators.
- Per-meal nutrition logging with custom foods, local search, favorites, recents, serving-based macro calculations, and historical food snapshots.
- Optional browser-direct USDA FoodData Central search and barcode lookup. USDA results are cached locally for later offline reuse.
- Portable, versioned JSON backup/restore that excludes local API credentials. Restore exports a protective backup immediately before replacing app data.
- Native barcode detection where available plus a ZXing fallback, rear-camera preference, torch support where supported, haptic feedback, duplicate suppression, and manual UPC/EAN entry.

## Architecture

```text
src/
├── app/                 # App composition, global styles, routing shell
├── components/          # Reusable mobile UI components
├── db/                  # Dexie database, schema and data migrations
│   └── repositories/    # Centralized table access
├── features/            # Dashboard, nutrition, workouts, progress, settings screens
├── services/            # Backup and external food-source contracts
├── types/               # Domain types
└── utils/               # Pure shared helpers
```

The IndexedDB schema creates stores for settings, metadata, isolated local credentials, foods, nutrients, servings, barcode mappings, favorites, recents, food logs, exercises, templates, schedules, workout sessions/exercises/sets, and weight logs. Query indexes target the relationships and date lookups required as the app grows. Database updates use explicit Dexie versions and migrations—never a data reset.

Completed workout sessions contain a template snapshot and an exercise snapshot, so later edits cannot rewrite historical training data. Active sessions and rest timer timestamps are persisted immediately, making an interrupted workout recoverable after closing the PWA.

## Local development

Install Node.js 22+ and then run:

```bash
npm install
npm run dev
```

The local development URL is printed by Vite.

## Quality checks and production build

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

For a repository named `fitness-app`, build with the GitHub Pages subdirectory locally using:

```bash
BASE_PATH=/fitness-app/ npm run build
```

On Windows PowerShell:

```powershell
$env:BASE_PATH = '/fitness-app/'
npm run build
```

The application uses `HashRouter`, so a route has the form `https://username.github.io/fitness-app/#/nutrition`. It stays refresh-safe beneath a project Pages URL.

## GitHub Pages deployment

1. Push the repository to GitHub, with the default branch named `main`.
2. In **Settings → Pages**, select **GitHub Actions** as the source.
3. Push to `main`. The included workflow runs install, TypeScript, ESLint, tests, build, then deploys `dist`.
4. Open the Pages URL supplied by the workflow.

The workflow sets `BASE_PATH` from the repository name. If deploying to a user/organization root site (`username.github.io`), change the workflow build environment to `BASE_PATH: /`.

## Install on iPhone

1. Open the deployed site in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Open Pocket Pace from the Home Screen for its standalone experience.

The shell honors top and bottom iPhone safe areas. The service worker caches the application shell and static assets for offline launches.

## Camera permissions

Barcode scanning requests Safari camera access only after you start scanning and prefers the rear camera. On iPhone, use the site/PWA through Safari and allow camera access when prompted. If native `BarcodeDetector` is unavailable, Pocket Pace uses its bundled ZXing fallback; manual UPC/EAN entry is always available.

## USDA FoodData Central

Paste your own FoodData Central/data.gov key in Settings to enable browser-direct search and barcode lookup. The app calls the documented FoodData Central food-search and food-detail endpoints, caches selected results locally, and remains usable without a key for custom/local foods. See the [official FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/) for key provisioning and request limits.

No API key is committed to source control, shown in the UI after entry, logged, or included in the standard fitness backup. A static GitHub Pages client cannot keep a user-provided key secret from that user’s own browser profile; it only keeps it local to that profile and separate from exported fitness data.

## Backups

Create and restore backups from:

```text
Settings → Backup & Restore → Export Backup
```

Backups are complete, human-readable, versioned JSON files and exclude credentials by default. Imports validate the format and show a data-count summary before replacement. Choosing **Export & replace** first downloads the current local state, then replaces fitness data while retaining locally stored credentials.

## Data safety

Clearing Safari website data, deleting the PWA/site storage, or using private browsing can remove local IndexedDB data. Export a JSON backup periodically.
