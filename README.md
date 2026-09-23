# Averagepace

A free, open leaderboard for 5K/10K/half/marathon times — for everyone, not
just the elites. Log your official race results yourself; link the official
result page and anyone can check it. See `backend/trust_score.py` for the
scoring logic.

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
`.env.example` includes placeholder `GOOGLE_CLIENT_ID`/`SESSION_SECRET` values —
the app runs fine with the placeholders, but real Google sign-in needs a real
Client ID (see `DEPLOY.md` for how to create one).

### 3. Frontend

```bash
cd frontend
cp .env.example .env      # defaults to http://localhost:8000
npm install
npm run dev
```

Then open http://localhost:5173

- `/` — the feed: "Following" (requires sign-in) and "Everyone" (public) tabs,
  Twitter-style. Signed-in users get a composer to post text updates.
- `/submit` — sign in with Google, enter your distance and time, and
  optionally link your official race result — an optional caption is posted
  to the feed alongside the run. (GPX upload still works via the API and
  `trust_score.py` — it's just not exposed in this UI right now.)
- `/leaderboard?distance=5k&tier=all` — view rankings, no sign-in needed (distance: 5k, 10k, half, marathon; tier: all, green)
- `/profile` — redirects to your own `/profile/:userId`
- `/profile/:userId` — any user's public profile: avatar, follower/following
  counts, follow button, and their posts. Your own profile also shows a
  "Private account" toggle and a follow-requests inbox.
- `/profile/:userId/followers` / `/following` — follower/following lists

Setting your own profile to private (Instagram/Twitter-style "protected
account"): new followers need your approval, non-followers can't see your
posts or follower/following lists, and your runs drop off the public
leaderboard until you go public again. Existing followers and any request
still pending when you go public are unaffected — going public
auto-accepts anything left pending.

## API

- `GET /api/health` — liveness check
- `POST /api/auth/google` — body `{"credential": "<google id token>"}`, returns `{token, user}`
- `GET /api/auth/me` — current user, given `Authorization: Bearer <token>`
- `PATCH /api/auth/me` — body `{"is_private": bool}`, requires auth; toggles your own privacy
- `POST /api/upload` — requires `Authorization: Bearer <token>`; multipart form:
  `claimed_distance_km`, optional `caption` and `result_url` (must be a valid
  `http(s)://` URL), and either `gpx_file` or `claimed_duration_s` (pace is
  computed from distance + duration; name comes from your Google account).
  Creates a feed post linked to the run.
- `GET /api/leaderboard?distance=5k&tier=all` — JSON rows, public; excludes
  runs by users currently set to private
- `GET /api/feed?scope=following|everyone` — feed posts; `following` requires
  auth and includes private accounts you're an approved follower of;
  `everyone` only ever shows posts from public accounts
- `POST /api/posts` — body `{"body": "<text>"}`, requires auth; text-only post (max 500 chars)
- `PATCH /api/posts/{post_id}` — body `{"body": "<text>"}`, requires auth and
  ownership; edits a post's text (including adding/clearing a run post's
  caption). Empty body is only allowed when the post has a linked run.
- `GET /api/users/{user_id}` — public profile (name/avatar, `is_private`,
  follower/following counts, `follow_status`: self/none/pending/accepted);
  never exposes email
- `GET /api/users/{user_id}/posts` / `/followers` / `/following` — gated for
  private accounts: returns `{"gated": true, ...: []}` unless the caller is
  the account itself or an approved follower
- `POST` / `DELETE /api/users/{user_id}/follow` — follow/unfollow, requires
  auth. Following a public account is instant (`{"status": "accepted"}`);
  following a private one creates a request (`{"status": "pending"}`) until
  approved. DELETE also cancels a still-pending request.
- `GET /api/follow-requests` — pending requests to follow you, requires auth
- `POST /api/follow-requests/{requester_id}/accept` / `/decline` — resolve a
  pending request, requires auth (only the target of the request can call this)

CORS is controlled by `CORS_ORIGINS` in `backend/.env` (comma-separated origins).

## Deploying

See `DEPLOY.md` for a step-by-step free-tier deployment guide (Neon +
Render + Vercel/Netlify). `render.yaml`, `frontend/vercel.json`, and
`netlify.toml` are already set up for it.

## How the trust score works

Three ways a submission earns its tier:

1. **GPX file → green/yellow/red, automated.** `backend/trust_score.py`
   checks the GPS track against five things: speed jumps (>10 m/s between
   points), pace floor (faster than a safe margin below world-record pace),
   distance mismatch vs. claimed distance (>5%), implausible elevation gain,
   and duplicate-file detection (SHA-256 hash). Score maps to a tier: green
   (85+), yellow (50-84), red (<50). Not currently exposed in the `/submit`
   UI, but the endpoint and scoring logic are intact — see the `gpx_file`
   field in the API section above.
2. **Official result link → yellow, not automated.** Paste a link to your
   race's official result page alongside your manually-entered time. We
   don't fetch or parse it server-side — a lot of race-timing sites sit
   behind bot protection that makes that unreliable, and defeating that
   isn't something this app does. The link itself is the trust signal: it's
   shown on the entry (leaderboard, feed, profile) so anyone can click
   through and check it themselves. See `linked_result()` in `trust_score.py`.
3. **Bare manual entry → red, unverified.** Just a distance and a time, no
   GPX and no link. Recorded, but tier `red` / score 0, same as any other
   flagged entry — excluded whenever the leaderboard is filtered to
   verified-only. See `unverified_result()`.

If a GPX file is provided it always takes priority over a manual time or a
result link.

## Known limitations (read before treating this as production-ready)

- **No rate limiting.** A signed-in account could still script mass-submissions.
- **Thresholds are estimates**, not validated against real-world GPX data. Before
  going public, run this against a batch of real watch exports (including your
  own training runs) to see how often legitimate runs get false-flagged as yellow/red.
- **Official result links aren't verified, just linked.** Nothing stops
  someone from pasting an unrelated URL — the link is a citation other
  humans can check, not a machine-verified cross-check. No image/photo
  verification either.

## Natural next steps

1. Add Strava/Garmin OAuth so GPX doesn't need manual export (`stravalib` for Python)
2. Deploy — see `DEPLOY.md` (Neon + Render + Vercel/Netlify, all free tier)
3. Rate limiting per account
4. Add a "flag this result" button for community moderation on borderline (yellow) entries
