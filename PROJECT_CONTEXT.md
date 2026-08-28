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

## Current feature set (built + tested)

- **Upload flow** (`/`) — name, claimed distance, GPX file upload
- **Trust scoring** (`trust_score.py`) — five automated checks per upload:
  GPS speed jumps, pace-floor plausibility, claimed-vs-GPS distance mismatch,
  elevation sanity, duplicate-file detection (SHA-256 hash)
- **Trust tiers** — green (85+, high trust) / yellow (50-84, needs review) /
  red (<50, flagged) — shown immediately with specific flags raised
- **Leaderboard** (`/leaderboard`) — filterable by distance bucket and by
  tier (all vs. verified-only), sorted fastest-to-slowest
- **Storage** — SQLite (`averagepace.db`, auto-created on first run)
- **Design system** — "finish-line results board" identity: digital-timer
  monospace font (Space Mono) for all times, asphalt/chalk/lane-yellow
  palette. Documented at the top of `static/style.css`.

Everything above has been manually tested end-to-end (server started,
real HTTP requests made to `/upload` and `/leaderboard`, both a clean
synthetic GPX and a deliberately faked one were run through the scorer
to confirm tiering works as intended).

## Known gaps / not yet built

These were flagged as important before showing this to real users:

1. **No auth** — anyone can submit under any name right now. Needs user
   accounts, ideally tied to Strava/Garmin OAuth so a submission is linked
   to a real, persistent, connected account rather than a typed name.
2. **No OAuth sync** — GPX must be manually exported and uploaded. Adding
   Strava API / Garmin Connect API sync would remove the biggest adoption
   friction.
3. **No rate limiting** — someone could script mass submissions.
4. **SQLite won't hold up under real concurrent traffic** — migrate to
   Postgres before any real launch.
5. **Thresholds are estimates, not validated.** The pace floors, speed-jump
   limits, and distance-tolerance percentages in `trust_score.py` were set
   conservatively but have NOT been tested against a batch of real watch
   exports. Before trusting this publicly: run a founder's own real training
   GPX files (and a few friends') through `analyze_gpx_bytes()` and check for
   false positives (legit runs getting flagged yellow/red).
6. **No community moderation** — no way for other users to flag a
   suspicious-looking entry yet.
7. **No race-result cross-check** — the original idea included an optional
   "green+" tier that cross-references official race results (e.g. via the
   Athlinks API) for extra verification. Not implemented.

## Natural next steps, roughly in priority order

1. Validate trust-score thresholds against real GPX data (cheap, do this first)
2. Strava OAuth sync (removes the biggest friction point for adoption)
3. User accounts (needed before this is safe to make public)
4. Postgres migration
5. Rate limiting
6. Community flagging for yellow-tier entries

## Tech stack

- Backend: FastAPI (Python), Jinja2 templates, server-rendered HTML (no
  separate frontend framework/build step — intentionally simple for now)
- GPX parsing: `gpxpy`
- Storage: SQLite via the standard library `sqlite3` module
- No auth, no external services integrated yet

## Files

```
main.py              — FastAPI routes (/,  /upload,  /leaderboard)
trust_score.py        — GPX analysis + scoring logic (the core IP)
database.py           — SQLite schema + queries
templates/            — Jinja2 HTML templates (_base, upload, leaderboard)
static/style.css       — design system, documented inline at the top
requirements.txt
README.md              — setup instructions + scoring explanation (user-facing)
PROJECT_CONTEXT.md     — this file (session-continuity notes, not user-facing)
```
