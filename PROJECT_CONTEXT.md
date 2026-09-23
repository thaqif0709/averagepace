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

On top of the leaderboard sits a Twitter-style social layer: follow other
runners, and a home feed (Following/Everyone) of text posts and run
submissions, so ranking isn't the only reason to open the app.

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
  `/api/health`, `/api/auth/*`, `/api/feed`, `/api/posts`, `/api/users/*`,
  `/api/follow-requests/*`).
  PostgreSQL via `psycopg2` and a `DATABASE_URL` env var (no ORM — same
  hand-written SQL style as before, just Postgres syntax). CORS is
  env-configurable (`CORS_ORIGINS`) since the frontend is now a separate
  origin. Auth (`auth.py`) verifies Google ID tokens directly and issues its
  own 30-day JWT session — no third-party auth service, no client secret
  needed (Google's button-based sign-in only requires the Client ID to
  verify tokens against). `get_current_user_optional` lets endpoints (feed,
  public profiles) behave differently for signed-in vs. anonymous callers
  without requiring auth.
- **`frontend/`** — React + Vite SPA, `react-router-dom` for `/` (feed),
  `/submit`, `/leaderboard`, `/profile/:userId` (+ `/followers`,
  `/following`). Calls the backend over `fetch` (`frontend/src/api.js`).
  Auth state lives in a React context (`frontend/src/auth.jsx`), session
  token in `localStorage`. No server-side rendering; the design system
  (`frontend/src/index.css`) started as a port of the old `static/style.css`,
  since re-themed from dark/orange to a lighter, welcoming light theme
  (WCAG AA contrast-checked).
- **`docker-compose.yml`** at repo root — local Postgres for dev, matching
  `backend/.env.example`.

They deploy independently (e.g. backend on Render/Fly.io/Railway with a
managed Postgres, frontend as a static build on Vercel/Netlify). See
`README.md` for local run instructions.

## Current feature set (built + tested)

- **Auth** — Google sign-in (button-based, no redirect flow), our own
  30-day JWT session stored in `localStorage`. Submitting/posting/following
  requires being signed in; viewing the leaderboard, the "Everyone" feed, and
  public profiles doesn't.
- **Social layer** — Twitter-style. Users follow each other
  (`follows` table); posts (`posts` table) are either free-text or linked to
  a run (`run_id`), so a scored submission and a text update share one feed.
  Post owners can edit the text later (`PATCH /api/posts/{id}`, sets
  `edited_at`, shown in the UI as "· edited" - the DB's own
  `body IS NOT NULL OR run_id IS NOT NULL` CHECK constraint is what blocks
  emptying a text-only post, caught in `update_post()`).
  - **Home feed** (`/`) — "Following" and "Everyone" tabs (URL-driven via
    `?scope=`), a composer for text posts when signed in. "Everyone" only
    ever shows posts from public accounts.
  - **Public profile** (`/profile/:userId`) — anyone's avatar, name, a
    subtle padlock next to the name when `is_private`, follower/following
    counts, follow button (hidden on your own profile or when logged out),
    and their post history. Deliberately excludes email — `get_user_public()`
    in `database.py` only ever selects `id, name, avatar_url, is_private`.
  - **Follower/following lists** (`/profile/:userId/followers|following`)
  - **Private accounts** — a user can flip `users.is_private` (toggle on
    their own profile page). Follow-approval model, same idea as Instagram's
    "private account"/Twitter's "protected Tweets": following a private
    account creates a `follows` row with `status='pending'` instead of
    instantly `'accepted'`; the target sees pending requests on their own
    profile and can accept or decline (`/api/follow-requests/*`). Until
    accepted, non-followers get `{"gated": true}` from the posts/followers/
    following endpoints instead of real data — enforced server-side in
    `main.py` via `can_view_private_content()`, not just hidden in the UI.
    Going private does not affect existing (already-accepted) followers;
    going public auto-accepts anything left pending. A private user's runs
    are also excluded from the public `/leaderboard` while private (rejoins
    automatically on going public) — see `get_leaderboard()` in `database.py`.
    There's no "block": declining a request only removes that one row,
    nothing stops the same person from immediately requesting again.
- **Upload flow** (`/submit`) — claimed distance, plus either a manually
  entered time (auto-formatted as you type, e.g. `2548` → `25:48`; pace
  auto-computed) or a GPX file upload, plus an optional caption. GPX always
  wins if both are given. No GPX means no automated checks — saved as an
  unverified tier=red/score=0 entry instead (see `unverified_result()` in
  `trust_score.py`). Runner name comes from the authenticated Google account.
  A successful submission also creates a feed post linking the run, with the
  caption as its body.
- **Trust scoring** (`backend/trust_score.py`) — five automated checks per
  upload: GPS speed jumps, pace-floor plausibility, claimed-vs-GPS distance
  mismatch, elevation sanity, duplicate-file detection (SHA-256 hash)
- **Trust tiers** — green (85+, high trust) / yellow (50-84, needs review) /
  red (<50, flagged) — shown immediately with specific flags raised
- **Leaderboard** (`/leaderboard`) — filterable by distance bucket and by
  tier (all vs. verified-only), sorted fastest-to-slowest, filters reflected
  in the URL (shareable links); excludes runs by currently-private users
- **Storage** — PostgreSQL (was SQLite pre-restructure)
- **Design system** — light, welcoming palette (cream/charcoal/teal accent),
  WCAG AA contrast-checked; re-themed from an earlier dark/orange version.
  Type: Inter (body), Inter Tight (headings only, tighter optical sizing for
  large text), Space Mono (all numerals/times, the signature element) - fluid
  `clamp()` sizing on h1 and the split-time readout instead of fixed
  breakpoint jumps. Softer layered shadows and larger radii than the original
  flat-3px version. Nav collapses into a hamburger/slide-down menu below
  860px (`.nav-toggle`/`.mobile-menu` in `App.jsx` + `index.css`); the
  leaderboard table becomes labeled cards below 600px instead of hiding a
  column (`data-label` attributes in `LeaderboardPage.jsx`, CSS-only card
  layout). Documented at the top of `frontend/src/index.css`.

## Known gaps / not yet built

These were flagged as important before showing this to real users:

1. **No OAuth sync** — GPX must be manually exported and uploaded. Adding
   Strava API / Garmin Connect API sync would remove the biggest adoption
   friction.
2. **No rate limiting** — a signed-in account could still script mass
   submissions.
3. **Thresholds are estimates, not validated.** The pace floors, speed-jump
   limits, and distance-tolerance percentages in `trust_score.py` were set
   conservatively but have NOT been tested against a batch of real watch
   exports. Before trusting this publicly: run a founder's own real training
   GPX files (and a few friends') through `analyze_gpx_bytes()` and check for
   false positives (legit runs getting flagged yellow/red).
4. **No community moderation** — no way for other users to flag a
   suspicious-looking entry yet.
5. **No race-result cross-check** — the original idea included an optional
   "green+" tier that cross-references official race results (e.g. via the
   Athlinks API) for extra verification. Not implemented.
6. **No CI, no automated tests** — restructure was verified by hand
   end-to-end (see below), not by a test suite.
7. **Old (pre-auth) entries have no `user_id`** — they still display (name
   was already stored as free text) but aren't "claimed" by any profile.
   Fine at this scale; would need a decision if this ever had real users
   before auth existed.
8. **No notifications** — following someone or having someone comment/like
   (likes don't exist yet either) triggers nothing. Feed/profile are
   pull-only; you find out by checking.
9. **Feed and profile posts have no pagination** — `get_feed()` and
   `get_posts_for_user()` in `database.py` return a fixed `LIMIT` (50/100)
   with no cursor/offset. Fine at current scale, will silently truncate
   once any user or the global feed passes that count.
10. **No blocking, just decline** — a private user can decline a follow
    request, but nothing stops that person from immediately sending another
    one. There's also no way to remove an existing (already-accepted)
    follower short of them unfollowing themselves.

## Natural next steps, roughly in priority order

1. Validate trust-score thresholds against real GPX data (cheap, do this first)
2. Strava OAuth sync (removes the biggest friction point for adoption)
3. Rate limiting per account
4. Pagination on feed/profile posts before either can grow past the hardcoded limit
5. Notifications (new follower, new follow request, new post from someone you follow)
6. Blocking (stronger than decline - actually prevents a user from re-requesting or viewing your public info)
7. Community flagging for yellow-tier entries

Deployment is already live — see "Deployment (live)" below.

## Tech stack

- Backend: FastAPI (Python), PostgreSQL via `psycopg2`, no ORM
- Auth: `google-auth` (verifies Google ID tokens), `PyJWT` (our own session tokens)
- Frontend: React + Vite, `react-router-dom`, plain CSS (no component library)
- GPX parsing: `gpxpy`
- No other external services integrated

## Deployment (live)

Free tier, three services (see `DEPLOY.md` for the from-scratch setup):

- **Frontend** — Netlify, `https://averagepace.netlify.app`
- **Backend** — Render, `https://averagepace-api.onrender.com` (free plan
  sleeps after 15 min idle; first request after that takes ~30-50s)
- **Database** — Neon Postgres

`CORS_ORIGINS` on Render must match the Netlify URL exactly or every fetch
from the frontend fails with a generic "Failed to fetch" (bitten by this
twice — always curl an OPTIONS preflight to confirm before assuming the
frontend/backend code itself is broken).

## Files

```
backend/
  main.py              — FastAPI app + routes (health, auth, upload, leaderboard, feed, posts, users/follow)
  auth.py               — Google ID token verification, session JWT issue/verify,
                           get_current_user (required) / get_current_user_optional (public-but-auth-aware)
  trust_score.py        — GPX analysis + scoring logic (the core IP, unchanged since v1)
  database.py           — Postgres schema + queries (runs, users, follows w/ pending/accepted status, posts)
  requirements.txt
  .env.example           — DATABASE_URL, CORS_ORIGINS, GOOGLE_CLIENT_ID, SESSION_SECRET
frontend/
  src/
    main.jsx             — React entry point, router + AuthProvider setup
    App.jsx               — top nav (Home/Submit/Leaderboard/Profile+sign-out) + route table
    auth.jsx              — AuthContext: token/user state, localStorage persistence
    api.js                — fetch wrapper for the backend API
    format.js              — duration/pace parsing + formatting, live time-input auto-format
    index.css              — design system (light theme)
    components/
      GoogleSignInButton.jsx — wraps Google Identity Services' button
      PostCard.jsx            — one feed/profile post: author, timestamp, optional text,
                                 optional embedded run card
    pages/
      HomePage.jsx           — `/`, the feed (Following/Everyone tabs + composer)
      UploadPage.jsx          — `/submit`, gated behind sign-in, optional caption
      LeaderboardPage.jsx      — public
      ProfilePage.jsx          — `/profile/:userId`, any user's profile + follow button
                                 (Follow/Requested/Following); own profile also shows a
                                 privacy toggle and follow-requests inbox
                                 (also exports ProfileRedirect for bare `/profile`)
      FollowListPage.jsx       — `/profile/:userId/followers` and `/following`
  index.html             — loads the Google Identity Services script
  package.json
  vite.config.js
  .env.example           — VITE_API_URL, VITE_GOOGLE_CLIENT_ID
docker-compose.yml       — local Postgres for dev
README.md                 — setup instructions + scoring explanation (user-facing)
PROJECT_CONTEXT.md        — this file (session-continuity notes, not user-facing)
DEPLOY.md                  — free-tier deploy guide, incl. Google OAuth Client setup
```
