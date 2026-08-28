# Averagepace

A free, open leaderboard for 5K/10K/half/marathon times — for everyone, not
just the elites. Built from raw GPX files instead of paid API access. See
`trust_score.py` for the scoring logic.

## Run it locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Then open http://127.0.0.1:8000

- `/` — upload a GPX file, get a trust score, get added to the leaderboard
- `/leaderboard?distance=5k&tier=all` — view rankings (distance: 5k, 10k, half, marathon; tier: all, green)

Data lives in `averagepace.db` (SQLite), created automatically on first run.

## How the trust score works

`trust_score.py` checks each uploaded GPX against five things:
1. **GPS speed jumps** — consecutive points implying >10 m/s (faster than a sprint) get flagged as bad/faked GPS
2. **Pace floor** — pace faster than a safe margin below world-record pace per distance bucket gets flagged for manual review
3. **Distance mismatch** — claimed distance vs. GPS-measured distance, >5% difference gets flagged
4. **Elevation sanity** — implausible elevation gain relative to distance
5. **Duplicate detection** — SHA-256 hash of the file, rejected if already submitted

Score maps to a tier: green (85+, high trust), yellow (50-84, needs review),
red (<50, flagged). Only green/yellow are meant to be shown publicly by default;
tune this once you have real submissions to calibrate against.

## Known limitations (read before treating this as production-ready)

- **No auth.** Anyone can submit as any name. You'll want accounts + device-linked
  identity (e.g. "this GPX must come from an OAuth-connected Strava/Garmin account
  belonging to this user") before this is trustworthy at any scale.
- **No rate limiting.** Someone could script mass-submissions.
- **SQLite** is fine for a prototype, not for concurrent production traffic — move
  to Postgres before real users show up.
- **Thresholds are estimates**, not validated against real-world GPX data. Before
  going public, run this against a batch of real watch exports (including your
  own training runs) to see how often legitimate runs get false-flagged as yellow/red.
- **No image/photo verification, no race-result cross-check** — those were discussed
  as a "green+" tier but aren't implemented here yet.

## Natural next steps

1. Add Strava/Garmin OAuth so GPX doesn't need manual export (`stravalib` for Python)
2. Move SQLite → Postgres, deploy on Railway/Fly.io/Render (all have free tiers)
3. Add user accounts so a leaderboard entry is tied to a persistent profile, not just a typed name
4. Add a "flag this result" button for community moderation on borderline (yellow) entries
