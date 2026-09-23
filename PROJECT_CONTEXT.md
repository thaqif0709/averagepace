# Averagepace — Project Context

Read this first if you're picking up this project in a new session.

## What this is

A free, open running leaderboard (5K / 10K / Half / Marathon) built as an
alternative to Strava — free to use, easy to browse other people's times,
built for regular runners rather than elites. The core problem it solves:
most "free" running leaderboards aren't real leaderboards, and most real
leaderboards are gated behind Strava Premium.

The differentiator is trust scoring: instead of relying on an official race
timing partnership (which requires business relationships with timing
companies), it scores the trustworthiness of a runner's own uploaded GPX
file, so anyone can submit an honest training or race run and get ranked.

## Naming history

Went through ~30 candidate names before landing here (Trackrecord, Clocked,
Fairpace, Realmile, Pacekeeper, Bibfolk, Splitfolk, Pacery, Tikara, and
"time+word" combos were all checked and rejected — either trademarked,
already in use by an existing app/company, or rejected by the founder for
tone reasons). **Averagepace** was chosen for its self-aware, populist tone
("average" reclaimed as a badge, not an insult) and came back clean in an
informal web search. This was NOT a full USPTO/legal trademark clearance —
do that before spending real money on branding, domains, or marketing.

Domain `averagepace.com` / `.app` / `.run` had not been purchased as of this
writing — check availability before someone else grabs it.

## Architecture (post-restructure)

Originally a single FastAPI process rendering server-side Jinja2 HTML with
SQLite storage. Restructured into a real frontend/backend split:

- **`backend/`** — FastAPI, JSON-only API (`/api/upload`, `/api/leaderboard`,
  `/api/health`). PostgreSQL via `psycopg2` and a `DATABASE_URL` env var
  (no ORM — same hand-written SQL style as before, just Postgres syntax).
  CORS is env-configurable (`CORS_ORIGINS`) since the frontend is now a
  separate origin.
- **`frontend/`** — React + Vite SPA, `react-router-dom` for `/` and
  `/leaderboard`. Calls the backend over `fetch` (`frontend/src/api.js`).
  No server-side rendering; the design system (`frontend/src/index.css`)
  is a straight port of the old `static/style.css`, unchanged.
- **`docker-compose.yml`** at repo root — local Postgres for dev, matching
  `backend/.env.example`.

They deploy independently (e.g. backend on Render/Fly.io/Railway with a
managed Postgres, frontend as a static build on Vercel/Netlify). See
`README.md` for local run instructions.

## Current feature set (built + tested)

- **Upload flow** (`/`) — name, claimed distance, plus either a manually
  entered time (pace auto-computed) or a GPX file upload. GPX always wins if
  both are given. No GPX means no automated checks - saved as an unverified
  tier=red/score=0 entry instead (see `unverified_result()` in `trust_score.py`)
- **Trust scoring** (`backend/trust_score.py`) — five automated checks per
  upload: GPS speed jumps, pace-floor plausibility, claimed-vs-GPS distance
  mismatch, elevation sanity, duplicate-file detection (SHA-256 hash)
- **Trust tiers** — green (85+, high trust) / yellow (50-84, needs review) /
  red (<50, flagged) — shown immediately with specific flags raised
- **Leaderboard** (`/leaderboard`) — filterable by distance bucket and by
  tier (all vs. verified-only), sorted fastest-to-slowest, filters reflected
  in the URL (shareable links)
- **Storage** — PostgreSQL (was SQLite pre-restructure)
- **Design system** — "finish-line results board" identity: digital-timer
  monospace font (Space Mono) for all times, asphalt/chalk/lane-yellow
  palette. Documented at the top of `frontend/src/index.css`.

## Known gaps / not yet built

These were flagged as important before showing this to real users:

1. **No auth** — anyone can submit under any name right now. Needs user
   accounts, ideally tied to Strava/Garmin OAuth so a submission is linked
   to a real, persistent, connected account rather than a typed name.
2. **No OAuth sync** — GPX must be manually exported and uploaded. Adding
   Strava API / Garmin Connect API sync would remove the biggest adoption
   friction.
3. **No rate limiting** — someone could script mass submissions.
4. **Thresholds are estimates, not validated.** The pace floors, speed-jump
   limits, and distance-tolerance percentages in `trust_score.py` were set
   conservatively but have NOT been tested against a batch of real watch
   exports. Before trusting this publicly: run a founder's own real training
   GPX files (and a few friends') through `analyze_gpx_bytes()` and check for
   false positives (legit runs getting flagged yellow/red).
5. **No community moderation** — no way for other users to flag a
   suspicious-looking entry yet.
6. **No race-result cross-check** — the original idea included an optional
   "green+" tier that cross-references official race results (e.g. via the
   Athlinks API) for extra verification. Not implemented.
7. **No CI, no automated tests** — restructure was verified by hand
   end-to-end (see below), not by a test suite.

## Natural next steps, roughly in priority order

1. Validate trust-score thresholds against real GPX data (cheap, do this first)
2. Strava OAuth sync (removes the biggest friction point for adoption)
3. User accounts (needed before this is safe to make public)
4. Deploy: backend + managed Postgres on Render/Fly.io/Railway, frontend on Vercel/Netlify
5. Rate limiting
6. Community flagging for yellow-tier entries

## Tech stack

- Backend: FastAPI (Python), PostgreSQL via `psycopg2`, no ORM
- Frontend: React + Vite, `react-router-dom`, plain CSS (no component library)
- GPX parsing: `gpxpy`
- No auth, no external services integrated yet

## Files

```
backend/
  main.py              — FastAPI app + routes (/api/health, /api/upload, /api/leaderboard)
  trust_score.py        — GPX analysis + scoring logic (the core IP, unchanged since v1)
  database.py           — Postgres schema + queries
  requirements.txt
  .env.example           — DATABASE_URL, CORS_ORIGINS
frontend/
  src/
    main.jsx             — React entry point, router setup
    App.jsx               — top nav + route table
    api.js                — fetch wrapper for the backend API
    format.js              — duration/pace formatting (mirrors old Jinja2 filters)
    index.css              — design system, ported from static/style.css
    pages/
      UploadPage.jsx
      LeaderboardPage.jsx
  index.html
  package.json
  vite.config.js
  .env.example           — VITE_API_URL
docker-compose.yml       — local Postgres for dev
README.md                 — setup instructions + scoring explanation (user-facing)
PROJECT_CONTEXT.md        — this file (session-continuity notes, not user-facing)
```
