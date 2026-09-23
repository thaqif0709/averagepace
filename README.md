# Averagepace

A free, open leaderboard for 5K/10K/half/marathon times — for everyone, not
just the elites. Built from raw GPX files instead of paid API access. See
`backend/trust_score.py` for the scoring logic.

Two pieces, deployed separately:
- `backend/` — FastAPI JSON API, PostgreSQL storage
- `frontend/` — React (Vite) single-page app that talks to the API

## Run it locally

### 1. Database

```bash
docker compose up -d db
```

This starts Postgres on `localhost:5432` (user/password/db all `averagepace`,
see `docker-compose.yml`). Don't have Docker? Point `DATABASE_URL` at any
Postgres instance instead.

### 2. Backend

```bash
cd backend
cp .env.example .env      # defaults already match docker-compose
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Table creation happens automatically on startup (`init_db()` in `database.py`).

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # defaults to http://localhost:8000
npm install
npm run dev
```

Then open http://localhost:5173

- `/` — upload a GPX file, get a trust score, get added to the leaderboard
- `/leaderboard?distance=5k&tier=all` — view rankings (distance: 5k, 10k, half, marathon; tier: all, green)

## API

- `GET /api/health` — liveness check
- `POST /api/upload` — multipart form: `runner_name`, `claimed_distance_km`, and either
  `gpx_file` or `claimed_duration_s` (pace is computed from distance + duration)
- `GET /api/leaderboard?distance=5k&tier=all` — JSON rows

CORS is controlled by `CORS_ORIGINS` in `backend/.env` (comma-separated origins).

## Deploying

See `DEPLOY.md` for a step-by-step free-tier deployment guide (Neon +
Render + Vercel/Netlify). `render.yaml`, `frontend/vercel.json`, and
`netlify.toml` are already set up for it.

## How the trust score works

`backend/trust_score.py` checks each uploaded GPX against five things:
1. **GPS speed jumps** — consecutive points implying >10 m/s (faster than a sprint) get flagged as bad/faked GPS
2. **Pace floor** — pace faster than a safe margin below world-record pace per distance bucket gets flagged for manual review
3. **Distance mismatch** — claimed distance vs. GPS-measured distance, >5% difference gets flagged
4. **Elevation sanity** — implausible elevation gain relative to distance
5. **Duplicate detection** — SHA-256 hash of the file, rejected if already submitted

Score maps to a tier: green (85+, high trust), yellow (50-84, needs review),
red (<50, flagged). Only green/yellow are meant to be shown publicly by default;
tune this once you have real submissions to calibrate against.

The GPX file itself is optional — enter your distance and time manually instead
(pace is calculated for you) and it's still recorded, but as tier `red` / score 0
with no automated checks run at all. Same treatment as any other flagged entry,
so it's excluded whenever the leaderboard is filtered to verified-only.
Attaching a GPX always takes priority over a manually-entered time.

## Known limitations (read before treating this as production-ready)

- **No auth.** Anyone can submit as any name. You'll want accounts + device-linked
  identity (e.g. "this GPX must come from an OAuth-connected Strava/Garmin account
  belonging to this user") before this is trustworthy at any scale.
- **No rate limiting.** Someone could script mass-submissions.
- **Thresholds are estimates**, not validated against real-world GPX data. Before
  going public, run this against a batch of real watch exports (including your
  own training runs) to see how often legitimate runs get false-flagged as yellow/red.
- **No image/photo verification, no race-result cross-check** — those were discussed
  as a "green+" tier but aren't implemented here yet.

## Natural next steps

1. Add Strava/Garmin OAuth so GPX doesn't need manual export (`stravalib` for Python)
2. Deploy — see `DEPLOY.md` (Neon + Render + Vercel/Netlify, all free tier)
3. Add user accounts so a leaderboard entry is tied to a persistent profile, not just a typed name
4. Add a "flag this result" button for community moderation on borderline (yellow) entries
