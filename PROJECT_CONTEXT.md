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
  `/submit`, `/leaderboard`, `/profile/:username` (+ `/followers`,
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
- **Analytics** (GA4, `frontend/src/analytics.js`) — page views, sign-ups,
  and logins, gated entirely behind `VITE_GA_MEASUREMENT_ID`: every export
  (`trackPageView`/`identifyUser`/`trackAuthEvent`/`clearUser`) is a no-op
  when it's unset, so local dev and any environment that hasn't configured
  it send nothing. The gtag.js snippet loads lazily on first use rather than
  from a `<script>` tag in `index.html`, so that gating is possible at all.
  Since this is a client-routed SPA, gtag's own automatic pageview is
  disabled (`send_page_view: false`) and `App.jsx` fires `page_view` itself
  on every `useLocation()` change instead - otherwise the first page would
  double-count. `identifyUser` calls GA4's User-ID feature with our own
  numeric `user.id` (never email/name) so "new users" reflects distinct
  accounts rather than distinct browsers. Telling a fresh signup apart from
  a returning login needed a backend change: `upsert_user()`'s `INSERT ...
  ON CONFLICT DO UPDATE` now also returns `(xmax = 0) AS is_new_user` - the
  standard trick for reading which branch an upsert took from its own
  `RETURNING` clause - and `/api/auth/google` passes that through
  (popped off the `user` object, returned as a sibling `is_new_user` field)
  so the frontend fires GA4's `sign_up` or `login` event correctly.
- **Usernames** (`users.username`, nullable TEXT) — a stable, human-chosen
  handle. `users.id` stays the real internal identifier (every FK - follows,
  posts, runs, vouches, likes - still points at that numeric id), but
  **profile URLs are username-based, Twitter/X style**: `/profile/:username`,
  not `/profile/:userId`. This is a deliberate one-way switch, not a
  redirect layer - there's no dual routing and no fallback to the old
  numeric-id URLs, which now 404 ("User not found") exactly like any other
  unrecognized profile. Renaming your username is not protected either: the
  old handle stops resolving immediately and, since it becomes available
  again, could in principle be claimed by a different account later - same
  tradeoff Twitter/X makes, chosen explicitly over a safer
  numeric-id-canonical-plus-redirect design. Format (3-20 chars,
  letters/numbers/underscores, validated in `clean_username()` in `main.py`)
  additionally *requires at least one non-digit character*
  (`^(?=.*[A-Za-z_])[A-Za-z0-9_]{3,20}$`) so an all-digits string can never
  be a valid username - that's what lets `/profile/:username` stay
  unambiguous, since old numeric ids would otherwise look like plausible
  usernames. Uniqueness is case-insensitive, enforced by a
  `UNIQUE INDEX ON (LOWER(username))` rather than a plain column constraint
  so any number of NULLs (accounts that haven't picked one yet) stay
  allowed; lookups resolve the same way (`get_user_by_username()` in
  `database.py`, `WHERE LOWER(username) = LOWER(%s)`), so
  `/profile/Alice_Runner` and `/profile/alice_runner` land on the same
  profile. `GET /api/username/check` live-checks availability (debounced
  350ms client-side, `useUsernameStatus.js`), excluding the caller's own
  current username so re-saving it unchanged doesn't read as "taken."
  `PATCH /api/auth/me` now accepts `username` alongside the pre-existing
  `is_private`, returns the full fresh user row either way. A brand-new or
  pre-existing account with `username IS NULL` gets a blocking modal
  (`ChooseUsernameDialog.jsx`, rendered at the `App.jsx` level whenever
  `user && !user.username`) that covers the page below the topbar (lower
  z-index than `.topbar`, so Sign out stays reachable as an escape hatch)
  until they pick one - no skip option; `ProfileRedirect` (bare `/profile`)
  also guards this window, sending a still-username-less user to `/` instead
  of a broken `/profile/undefined`. Editable later from your own profile
  page (`.username-edit-form` in `ProfilePage.jsx`, next to the privacy
  toggle). Shown as `@username` under the display name on any profile, and
  next to the author name on every post (`PostCard.jsx`) once `POST_SELECT`
  started including it. Every `/api/users/{username}/...` endpoint
  (profile, posts, best-efforts, runs, followers, following, follow/unfollow)
  resolves the username to a numeric id once via `get_user_by_username()`
  and 404s upfront if it doesn't exist, then behaves exactly as it did when
  keyed on the numeric id.
- **Search** (`GET /api/search?q=&type=people|posts|runs` - one endpoint,
  three unrelated queries behind a `type` switch, not merged results) - a
  search icon in the topbar (`SearchWidget.jsx`, always visible, not tucked
  behind the mobile hamburger since it's a primary action) opens a dropdown
  with a text input, three filter pills, and live debounced (300ms, 2-char
  minimum) results. People search matches name or username and returns
  every matching account regardless of privacy - an account is findable by
  name the way it is on Twitter/Instagram, only its *content* is gated, not
  its existence. Posts and event-runs search reuse that same privacy rule
  inline as a SQL condition (`u.is_private = FALSE OR <viewer owns it> OR
  <viewer follows it, accepted>) rather than filtering in Python, so a
  private account's own posts/runs are still findable by the account owner
  or their accepted followers, unlike the general "Everyone" feed/queue
  which - by design, elsewhere - shows *only* public accounts even to an
  account's own followers. Clicking a result routes to the runner's/
  author's profile - there's no post-permalink page, so a post result
  doesn't jump to the post itself. Result rows share one `ResultRow`
  component branching on `type`, since the three shapes need almost the same
  avatar+title+subtitle layout.
- **Social layer** — Twitter-style. Users follow each other
  (`follows` table); posts (`posts` table) are either free-text or linked to
  a run (`run_id`), so a scored submission and a text update share one feed.
  Post owners can edit the text later (`PATCH /api/posts/{id}`, sets
  `edited_at`, shown in the UI as "· edited" - the DB's own
  `body IS NOT NULL OR run_id IS NOT NULL` CHECK constraint is what blocks
  emptying a text-only post, caught in `update_post()`). The same PATCH also
  accepts `event_name`/`time_type`/`result_url` when the post has a run
  attached (`update_run_metadata()`), so those stay fixable after the fact -
  distance and duration deliberately don't, since vouches and leaderboard
  rank are earned against those exact numbers. Fixing a wrong distance/time
  means deleting the run (`DELETE /api/runs/{id}`, owner-only, cascades to
  its post and any vouches via FK) and resubmitting. A text-only post (no
  run attached) can be deleted too, via a separate `DELETE /api/posts/{id}`
  guarded to `run_id IS NULL` so it can never be used to bypass the run
  path's cascade. Both edit and delete sit behind a kebab (⋮) menu on the
  post - opens a small dropdown with "Edit"/"Delete"; picking "Edit" opens
  the existing inline form (which itself still has a "Delete" option once
  inside), while picking "Delete" jumps straight to that form's confirm
  step. The same menu is available per-row on the Best Efforts drill-down
  (`BestEffortDetailPage.jsx`'s `RunRow`), via a dedicated
  `PATCH /api/runs/{id}` (metadata-only, no caption in play there - reuses
  `update_run_metadata()`/`clean_run_metadata()` directly rather than going
  through a post).
  - **Home feed** (`/`) — "Following" and "Everyone" tabs (URL-driven via
    `?scope=`), a composer for text posts when signed in. "Everyone" only
    ever shows posts from public accounts. Logged-out visitors see a
    mission-statement hero instead of the bare feed: the problem (official
    times scattered across a different results site per race), a world
    record ticker (see below), the pitch (paste the link, log the time, one
    running history), the Strava jab (best-effort history sits behind a
    paywall there; it doesn't here), and a 3-step "how it works" before the
    public feed continues below as social proof. Swapped in purely on
    `!loading && !user` in `HomePage.jsx` - logged-in users see the same
    feed as always, no new route.
  - **World record ticker** (`WorldRecordTicker.jsx`, logged-out hero only)
    — a 6-digit `HH:MM:SS` readout that auto-advances every 2.8s through the
    men's and women's world records for the same 4 distances the app itself
    tracks (5K, 10K, half, marathon - 8 entries total, interleaved men's/
    women's per distance; data in `frontend/src/data/worldRecords.js`, each
    entry `{ distanceLabel, digits, holder, year }` - hand-maintained, no
    live data source, update it whenever a record falls; for the two road
    distances we use the mixed-sex-race women's time rather than the
    separate "women-only race" record, since that's the one usually meant
    by "the world record"). Labels are deliberately inconsistent, matching
    what's actually official: track events (5K/10K) are run as genuinely
    separate "Men's"/"Women's" competitions, so both get that prefix; road
    records aren't split that way for men (there's no official "Men's
    Marathon" title, it's just The Record), so those two entries are
    unprefixed, while "Women's Half Marathon"/"Women's Marathon" still say
    so since that women's-specific split is real and official. Rather than
    swapping the digits instantly, the
    clock actually counts from wherever it's currently sitting to the new
    target - forward or backward, whichever direction gets there - over
    1000ms with an ease-out curve, like a stopwatch/odometer physically
    running through the seconds rather than a labeled value just changing.
    That's driven by `requestAnimationFrame` interpolating total seconds
    (not a CSS `animation`/`transition`), which was a deliberate choice: it
    means `prefers-reduced-motion` can't reach it at all, same reasoning as
    the loading spinner - the count *is* the feature, not decoration on top
    of it. The meta line (distance/holder/year) below it still crossfades
    via a CSS keyframe keyed on `distanceLabel`, and that one does respect
    reduced-motion normally. `aria-hidden` on the whole widget since it's
    decorative and auto-updating, redundant with accessible text elsewhere
    on the page. The meta line forces `white-space: nowrap` +
    `text-overflow: ellipsis` rather than letting it wrap - some
    distance/holder/year combinations are longer than others (e.g. "Women's
    Half Marathon · Letesenbet Gidey · 2021"), and at mobile widths a
    wrapping one grew the whole card every time the ticker cycled to it.
    Truncating keeps the card's height constant across every record instead;
    the rare long one loses its trailing year to an ellipsis, which is a
    fine trade against the card visibly resizing every few seconds.
  - **Activity marquee** (`ActivityMarquee.jsx`, logged-out only, full-bleed
    above the hero, outside `.wrap`) — a horizontally-scrolling strip styled
    like an old orange dot-matrix LED sign (DotGothic16 - a genuine
    dot-matrix Google Font - in amber on near-black, `text-shadow` glow to
    sell the lit-LED look). Content comes from the same `posts` feed
    `HomePage.jsx` already fetches, no separate request: scored runs
    (`post.run_id` present) become lines like "ALICE JUST LOGGED A 5K —
    22:14" - but only once at least `MIN_DISTINCT_USERS` (4) *different*
    people show up in that batch; otherwise it shows the static value-prop
    fallback lines instead, not a mix of the two. Originally gated on raw
    post count, which broke exactly as you'd expect the first time it hit
    production: one account's 5 test runs cleared the count bar alone and
    the strip looped that one name over and over, reading like a bug rather
    than a quiet-but-real site. Re-gated on `new Set(posts.map(p =>
    p.user_id)).size` instead, and made the fallback a full replacement
    below threshold rather than a supplement above it - a couple of real
    messages padded out with generic lines still visibly loops the same
    name, so there's no partial-credit state worth keeping. Once it does
    clear the bar it repeats that message list as many times as needed to
    clear 450 characters before joining it into the track - the seamless
    -50% loop trick only works if one copy is at least as wide as the
    viewport, and a short message list comfortably fit within a single
    copy's width on a wide/ultrawide monitor otherwise, leaving a visible
    gap of bare background partway through the scroll (looked like the
    strip "went black"). Loops seamlessly by rendering that padded string
    twice back to back and animating `translateX` by exactly -50% of the
    track's own width. Deliberately ignores `prefers-reduced-motion` (an
    explicit request), same as the world-record ticker - but since this one
    is a real CSS `animation` rather than `requestAnimationFrame`, the
    global reduced-motion rule actually reaches it, so the override has to
    win the cascade on purpose: it redeclares the full `animation` shorthand
    on `.activity-marquee-track` with `!important`, which beats the global
    rule's `!important` on `*` because a class selector is more specific
    than the universal one. Scroll speed is calibrated relative to the
    container's width, not a fixed pixel rate: it targets "one
    container-width of text scrolls by every ~26.7s" (`1280 / 48`, tuned
    against a ~1280px desktop view feeling right), not a flat px/s - a flat
    rate covers proportionally more of a narrow phone screen every second
    than a wide desktop one, so it read as much faster on mobile even
    though the CSS-pixel speed was identical. A `useLayoutEffect` measures
    the rendered track's width and its container's width once mounted and
    sets `--marquee-duration` (read by both the normal and reduced-motion
    `animation` rules) to `trackWidth / (containerWidth / 26.7)`, and a
    `ResizeObserver` on the container re-applies it on any size change
    (window resize, phone rotation) so it doesn't go stale after mount.
    Runs before the first paint - no flash of the wrong speed. That relative
    pace alone made phone-width screens feel sluggish on their own terms
    (~14.6px/s at 390px), so the speed is also floored at 24px/s - below
    that, `Math.max` takes over; above ~640px-wide containers the
    proportional formula already clears the floor on its own, so desktop is
    unaffected.
  - **Public profile** (`/profile/:username`) — anyone's avatar, name, a
    subtle padlock next to the name when `is_private`, follower/following
    counts, follow button (hidden on your own profile or when logged out),
    and their post history. Deliberately excludes email — `get_user_public()`/
    `get_user_by_username()` in `database.py` only ever select
    `id, name, avatar_url, is_private, username`.
  - **Follower/following lists** (`/profile/:username/followers|following`)
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
- **Upload flow** (`/submit`) — claimed distance plus a manually entered time
  (auto-formatted as you type, e.g. `2548` → `25:48`; pace auto-computed),
  an optional link to an official race result, an optional gun/chip time tag,
  and an optional caption. Distance has one-tap presets for the four
  standard race lengths (5K/10K/Half/Marathon, filling in the exact
  5/10/21.1/42.2 km rather than relying on the runner to know or type the
  precise figure - the free-text input stays too, for anything non-standard)
  - `bucket_for_distance()` in `trust_score.py` already tolerates some
  imprecision (it buckets by range, not exact match), but the presets remove
  the guesswork entirely rather than just relying on that tolerance. Runner
  name comes from the authenticated Google account. A successful submission
  also creates a feed post linking the run, with the caption as its body.
  GPX upload is **not exposed in this UI** as of the pivot away from
  device-file verification toward logging official races (see below) - the
  `gpx_file` form field, `analyze_gpx_bytes()`, and the whole green/yellow
  GPX-analysis path are all still there in `backend/`, untouched, reachable
  directly via the API. Bringing the picker back is a pure frontend change.
- **Gun time / chip time** (`time_type` on `runs`, nullable, `'gun'` or
  `'chip'`) — purely an informational tag, not fed into trust scoring. Race
  clocks report gun time (from the start signal) and chip time (net, from
  crossing the start mat) differently, so tagging which one was entered lets
  anyone checking the linked result know which figure to compare against.
  Shown as a small pill next to the time everywhere a run appears (feed,
  profile, leaderboard, the post-submit result card).
- **Trust scoring** (`backend/trust_score.py`) — three paths to an automated
  score/tier, capped at yellow (see "Admin verification" below for how a run
  actually reaches green):
  1. GPX file (API-only right now) → automated: five checks (GPS speed
     jumps, pace-floor plausibility, claimed-vs-GPS distance mismatch,
     elevation sanity, duplicate-file detection via SHA-256 hash) → yellow/
     red by score (`score >= 50` is yellow, capped there - no automated path
     reaches green).
  2. Manual entry + an official result link (`result_url` on `runs`) →
     always yellow/score 60, via `linked_result()`. Not machine-verified -
     deliberately so, since checking it server-side would mean scraping
     third-party race-timing sites, several of which (confirmed:
     checkpointspot.asia) sit behind real Cloudflare bot-verification
     challenges. Building something to auto-solve that wasn't something to
     build regardless of feasibility - it's the site's explicit signal it
     doesn't want automated access. The link itself is the trust signal:
     shown as a citation on the entry (leaderboard, feed, profile) for any
     human to click through and check.
  3. Manual entry, no link → always red/score 0, via `unverified_result()`.
- **Trust tiers** — green (admin-verified, see below) / yellow (either
  GPX-plausible-but-flagged or link-backed, not yet reviewed) / red (no
  evidence at all) — shown immediately with specific flags raised
- **Admin verification** — green used to mean "our own automated GPS
  analysis was confident" (score >= 85); it now means a human on our side
  actually checked the link. `users.is_admin` (bootstrapped from the
  `ADMIN_EMAILS` env var, comma-separated, matched at every `init_db()` run
  - there's no in-app way to grant it) gates `/admin` (`AdminReviewPage.jsx`)
  and four endpoints, all behind `get_current_admin_user` in `auth.py`
  (403s a non-admin): `GET /api/admin/review-queue` (every run with a
  `result_url` and no `verified_by_admin_id` yet, oldest first),
  `GET /api/admin/verified` (the 20 most recently verified, newest first),
  `POST /api/admin/runs/{id}/verify` (sets `tier='green'`,
  `verified_by_admin_id`, `verified_at`), and `.../unverify` (reverts to
  yellow). The page shows both lists - a "Review queue" table with a Verify
  button per row, and a "Recently verified" table below it with an Undo
  button that calls unverify - so a mis-click has an immediate, visible way
  back rather than only a reachable-by-curl safety valve. Both tables share
  one `RunRow`/`RunTable` component in `AdminReviewPage.jsx`; verifying or
  undoing moves the run between the two lists' local state directly rather
  than re-fetching either endpoint. A migration downgrades any pre-existing
  automated-green run to yellow the first time this runs, since none of
  those were actually admin-checked.
- **Vouches** (`vouches` table, `user_id`+`run_id` primary key) — social
  proof, deliberately kept separate from trust scoring rather than feeding
  into the tier/score, so a run's tier stays an objective signal and vouching
  can't be brigaded into inflating it. Any signed-in user except the runner
  can vouch for a run once (toggle on `POST`/`DELETE /api/runs/{id}/vouch`).
  Shown as an interactive "Vouch"/"Vouched · N" pill on posts in the feed and
  profile (`PostCard.jsx`) for other viewers, a plain "N vouched" readout for
  the runner's own view and logged-out visitors, and a read-only count on the
  leaderboard.
- **Likes** (`likes` table, `user_id`+`post_id` primary key) — plain
  engagement, architecturally separate from vouches: applies to *any* post
  (text-only or run-attached) and carries no trust/scoring meaning at all,
  vs. vouches which only exist on runs and are specifically a trust signal.
  Same toggle mechanism as vouches (`POST`/`DELETE /api/posts/{id}/like`,
  `ON CONFLICT DO NOTHING` for idempotent add), same self-restriction as a UX
  convention rather than an integrity rule. Shown as a "Like"/"Liked · N"
  pill (`PostCard.jsx`, own `.like-button` CSS mirroring `.vouch-button`) for
  other signed-in viewers, a plain "N like(s)" readout for the poster's own
  view and logged-out visitors.
- **Best efforts** (`GET /api/users/{username}/best-efforts`) — each runner's
  fastest submission per distance bucket, one row via
  `ROW_NUMBER() OVER (PARTITION BY distance_bucket ORDER BY duration_s ASC)`
  in `get_best_efforts()`; buckets with no submissions are simply absent, not
  zero-filled. Shown as a small card grid near the top of the profile page
  (`ProfilePage.jsx`, ordered 5K→10K→Half→Marathon), gated by the same
  `can_view_private_content` privacy check as posts. Requested explicitly as
  a Strava feature that's normally paywalled there. Each card links to
  `/profile/:username/best/:distanceBucket` (`BestEffortDetailPage.jsx`,
  backed by `GET /api/users/{username}/runs?distance=`), a drill-down listing every
  submission at that one distance, fastest first - reuses the leaderboard's
  `<table>`/`data-label` markup so it gets the same mobile card layout for
  free.
  - Each card's meta row (`.best-effort-meta`, a flex row: tier-dot + pace +
    optional CHIP/GUN `.time-type-tag` pill) had a bug where the tier-dot
    rendered as a full circle on some cards but only a thin sliver on
    others (reported: visible on 5K, clipped on Half Marathon/Marathon).
    Root cause: `.tier-dot` had no `flex-shrink`, and being an empty
    `<span>` its content-based minimum width is 0, so whenever the row's
    content (dot + pace + tag) didn't fit the card, flexbox shrank the dot
    - the only child with room to give - down toward 0 width while its
    fixed 8px height stayed put, turning the circle into a vertical
    sliver. The 1-character difference between "GUN" and "CHIP" was enough
    to push some cards over the threshold and not others, matching the
    reported pattern exactly (confirmed via a standalone Playwright repro
    sweeping container widths before touching any CSS). Fixed by giving
    both fixed-size decorations (`.tier-dot`, `.time-type-tag`) explicit
    `flex-shrink: 0` so neither ever deforms, and wrapping the pace text in
    its own `.best-effort-pace` span with `min-width: 0` +
    `overflow/text-overflow/white-space` ellipsis so *it* is the one
    element that gracefully truncates under real space pressure - the same
    technique already used for `.best-effort-event` and `.wr-ticker-meta`.
    Verified the dot stays a perfect 8x8 circle from the grid's normal
    range down to its absolute minimum card width (140px), where the pace
    text truncates instead of the dot deforming or the row overflowing the
    card.
  - On the drill-down table (`BestEffortDetailPage.jsx`), each row's ⋮ entry
    menu (`.run-actions-cell`, edit/delete for `isOwn` viewers) sat in its
    own trailing table column on desktop, which the `max-width: 600px`
    card-ification (`table,tbody,tr,td { display:block }` + `data-label`
    pseudo-labels, shared with the leaderboard) turned into its own
    full-width row at the bottom of the mobile card, under Trust. Moved it
    onto the same line as the rank/date row on mobile specifically (the
    card's first line, e.g. "① 23/09/2026 ⋮"), matching where the analogous
    per-item menu sits on post cards. Done with a CSS-only, mobile-only rule
    scoped by `tr:has(.run-actions-cell)` - a selector only this table's
    rows match (`.run-actions-cell` isn't used anywhere else, confirmed via
    a repo-wide grep), so the leaderboard and admin-review tables that share
    the same base card CSS are untouched. Inside that scope, the `<tr>`
    becomes a `display: grid` with two columns (`1fr auto`) and named
    `grid-template-areas` pairing the rank cell with the actions cell in one
    row while Event/Time/Pace/Trust keep their own full-width rows below;
    the actions cell also picks up the rank cell's divider styling
    (border-bottom/margin/padding) so the underline still spans the full
    row instead of stopping under the date. No JSX/DOM changes, so
    desktop's plain table layout (already one line per row by definition)
    is untouched - verified via a standalone Playwright repro at
    320/375/414px (menu inline with the rank/date row, divider intact, no
    overlap even with a long event name wrapping to two lines below it) and
    700px (identical to before).
- **Event names** (`event_name` on `runs`, free text, optional, 200 char cap)
  — typed in on `/submit`, no separate events table. As you type, `GET
  /api/events/suggest?q=` (`suggest_event_names()`) autocompletes against
  existing names via a case-insensitive prefix match, ranked by how many
  runs already use that exact name - the mechanism that keeps everyone
  converging on one spelling per event instead of "Klang Marathon" /
  "klang marathon 2026" splintering apart. Private users' runs are excluded
  from suggestions so a name can never hint at what a private account ran.
  Shown next to the distance everywhere a run appears (e.g. "5K — Klang
  Marathon 2026"). A dedicated per-event page (its own mini-leaderboard of
  everyone who ran that event) was explicitly scoped out as too big for now.
- **Event date** (`event_date` on `runs`, optional `DATE`, distinct from
  `created_at` - when the race happened vs. when it was logged, so a run can
  be entered after the fact) — an optional date input on `/submit` (capped
  at today; a race can't be in the future), editable later same as event
  name/time type/result link. Shown as "(Mar 15, 2026)" next to the event
  name everywhere a run appears - or on its own if there's a date but no
  name - via `formatEventDate()` in `format.js`, which parses the
  "YYYY-MM-DD" string's components directly rather than through `new
  Date(str)` to avoid that reading a bare date as UTC midnight and
  displaying a day early west of UTC.
- **Leaderboard** (`/leaderboard`) — filterable by distance bucket and by
  tier (all vs. verified-only), sorted fastest-to-slowest, filters reflected
  in the URL (shareable links); excludes runs by currently-private users.
  Top 3 rank badges are gold/silver/bronze (`tbody tr:nth-child(1/2/3)
  .rank` in `index.css`) rather than a single "highlight the winner" color.
  `.rank` is always a fixed 24x24 flex box regardless of place, so the
  rank column's width doesn't vary row to row and names stay aligned
  down the column — it used to be a plain inline `<span>` with a
  `min-width` that (being inline) never actually applied, so only rank 1's
  circle badge had a real fixed width and every other row's name started
  at a slightly different x-position.
- **Storage** — PostgreSQL (was SQLite pre-restructure)
- **Design system** — light, welcoming palette (cream/charcoal/Tyrian purple
  accent),
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
- **Loading state** (`RunningLoader.jsx`) — a small stopwatch Lottie
  animation (`src/assets/timer-loader.json`, recolored from its original
  black to the `--accent` brand color) rendered via `lottie-web`'s light
  build (`lottie-web/build/player/lottie_light`, no expressions parser,
  smaller than the full build), shown wherever a page currently renders
  nothing while its data loads: the feed, a profile, the leaderboard, the
  Best Efforts drill-down, and follower/following lists. The JSON asset is
  bundled locally (not fetched from a CDN at runtime) so the loading
  indicator itself never depends on an external network call. Always
  autoplays regardless of `prefers-reduced-motion` - an earlier version
  froze it on that setting (matching how the previous hand-rolled SVG
  runner behaved), but a small self-contained "something is loading" spinner
  is functional UI, not the large-scale decorative motion (parallax,
  auto-scroll) that setting exists to suppress, and freezing it just reads
  as broken on a device with that setting on.

## Known gaps / not yet built

These were flagged as important before showing this to real users:

1. **No OAuth sync** — GPX must be manually exported and uploaded (and isn't
   even offered in the UI right now - see "Upload flow" above). Adding
   Strava API / Garmin Connect API sync would remove the biggest adoption
   friction for that path, if it comes back.
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
5. **Result links aren't cross-checked, just linked.** Runners can attach an
   official race-result URL (yellow tier), but nothing on the backend fetches
   or verifies it - deliberately, since the sites tend to sit behind bot
   protection (see "Trust scoring" above). It's a citation for a human to
   click, not a "green+" automated cross-check. Nothing stops pasting an
   unrelated link.
6. **No CI, no automated tests** — restructure was verified by hand
   end-to-end (see below), not by a test suite.
7. **Old (pre-auth) entries have no `user_id`** — they still display (name
   was already stored as free text) but aren't "claimed" by any profile.
   Fine at this scale; would need a decision if this ever had real users
   before auth existed.
8. **No notifications** — following someone, or having someone vouch for,
   like, or comment on your post, triggers nothing. Feed/profile are
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
  sleeps after 15 min idle; first request after that takes ~30-50s). Kept
  warm by `.github/workflows/keep-alive.yml`, a scheduled GitHub Action
  (`*/10 * * * *`, well inside the 15-min window) that curls `/api/health`.
  Chose a GitHub Action over Render's own Cron Job service since it's free
  regardless of plan/usage, versioned with the code, and doesn't depend on
  any one chat session staying alive; also runnable on demand via
  `workflow_dispatch`. Neon's own autosuspend (below) still applies
  independently, but wakes in ~1-2s so it's not the one worth ping-guarding.
- **Database** — Neon Postgres (autoscaling, autosuspends after a few
  minutes idle - fast to resume, not the source of the noticeable cold
  start above)

`CORS_ORIGINS` on Render must match the Netlify URL exactly or every fetch
from the frontend fails with a generic "Failed to fetch" (bitten by this
twice — always curl an OPTIONS preflight to confirm before assuming the
frontend/backend code itself is broken).

`ADMIN_EMAILS` on Render (comma-separated) is what makes someone an admin -
applied inside `init_db()`, which runs once at process start, so it only
takes effect for an email that already has a user row (i.e. has signed in
at least once) as of the *next* deploy/restart after the env var is set or
changed.

## Files

```
backend/
  main.py              — FastAPI app + routes (health, auth, upload, leaderboard, feed, posts,
                           users/follow, admin review queue)
  auth.py               — Google ID token verification, session JWT issue/verify,
                           get_current_user (required) / get_current_user_optional
                           (public-but-auth-aware) / get_current_admin_user (403s non-admins)
  trust_score.py        — GPX analysis (yellow/red, capped - green is admin-only now),
                           linked_result() (official-link submissions, always yellow),
                           unverified_result() (bare claims, red)
  database.py           — Postgres schema + queries (runs incl. result_url and
                           verified_by_admin_id/verified_at, users incl. is_admin, follows
                           w/ pending/accepted status, posts)
  requirements.txt
  .env.example           — DATABASE_URL, CORS_ORIGINS, GOOGLE_CLIENT_ID, SESSION_SECRET,
                           ADMIN_EMAILS
frontend/
  src/
    main.jsx             — React entry point, router + AuthProvider setup
    App.jsx               — top nav (Home/Submit/Leaderboard/Profile/Admin-if-admin+sign-out)
                             + route table
    auth.jsx              — AuthContext: token/user state, localStorage persistence
    api.js                — fetch wrapper for the backend API
    format.js              — duration/pace parsing + formatting, live time-input auto-format
    index.css              — design system (light theme)
    components/
      GoogleSignInButton.jsx — wraps Google Identity Services' button
      PostCard.jsx            — one feed/profile post: author, timestamp, optional text,
                                 optional embedded run card
      SearchWidget.jsx        — topbar search icon + dropdown (input, People/Posts/Events
                                 filter pills, live debounced results)
    pages/
      HomePage.jsx           — `/`, the feed (Following/Everyone tabs + composer)
      UploadPage.jsx          — `/submit`, gated behind sign-in, distance/time + optional
                                 official-result link + optional caption (no GPX picker)
      LeaderboardPage.jsx      — public
      ProfilePage.jsx          — `/profile/:username`, any user's profile + follow button
                                 (Follow/Requested/Following); own profile also shows a
                                 privacy toggle and follow-requests inbox
                                 (also exports ProfileRedirect for bare `/profile`)
      FollowListPage.jsx       — `/profile/:username/followers` and `/following`
      AdminReviewPage.jsx       — `/admin`, gated on `user.is_admin` (backend still enforces
                                 it independently); review queue + a Verify button per run
  index.html             — loads the Google Identity Services script
  package.json
  vite.config.js
  .env.example           — VITE_API_URL, VITE_GOOGLE_CLIENT_ID
docker-compose.yml       — local Postgres for dev
README.md                 — setup instructions + scoring explanation (user-facing)
PROJECT_CONTEXT.md        — this file (session-continuity notes, not user-facing)
DEPLOY.md                  — free-tier deploy guide, incl. Google OAuth Client setup
```
