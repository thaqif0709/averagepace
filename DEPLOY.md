# Deploying Averagepace (free tier)

Three accounts, created in this order — each step needs a value copied from
the previous one, so don't skip around.

## 1. Database — Neon

1. Sign up at https://neon.tech with your GitHub account (free, no card).
2. Create a project (any name/region is fine).
3. On the project dashboard, copy the **connection string**. It looks like:
   `postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
4. Keep that tab open — you'll paste it into Render next.

(Supabase is an equally good alternative if you'd rather use that instead —
same idea, just copy its connection string in step 2 of the next section.)

## 2. Backend — Render

1. Sign up at https://render.com with your GitHub account.
2. **New → Blueprint**, pick the `averagepace` repo. Render reads
   `render.yaml` at the repo root and proposes an `averagepace-api` web
   service automatically (root directory `backend`, free plan).
3. It'll prompt for two environment variables:
   - `DATABASE_URL` → paste the Neon connection string from step 1
   - `CORS_ORIGINS` → leave blank for now, you'll set it in step 4
4. Deploy. Once live, copy the service URL Render gives you, e.g.
   `https://averagepace-api-xxxx.onrender.com`

Render's free tier spins the service down after 15 minutes with no traffic.
The first request after that takes ~30-50s to wake it back up — normal for
a free demo, nothing to fix.

## 3. Frontend — Vercel (or Netlify)

Pick one.

**Vercel:**
1. Sign up at https://vercel.com with your GitHub account.
2. **Add New → Project**, pick the `averagepace` repo.
3. Set **Root Directory** to `frontend` (Vercel then auto-detects Vite).
4. Add an environment variable: `VITE_API_URL` = the Render URL from step 2.
5. Deploy. Copy the resulting URL, e.g. `https://averagepace-xxxx.vercel.app`

**Netlify (alternative):**
1. Sign up at https://netlify.com with your GitHub account.
2. **Add new site → Import an existing project**, pick the repo — it reads
   `netlify.toml` at the repo root automatically (base dir `frontend`).
3. Add an environment variable: `VITE_API_URL` = the Render URL from step 2.
4. Deploy. Copy the resulting URL.

Either way: `VITE_API_URL` is baked into the build, not read at runtime — if
you ever change it, you need to trigger a new deploy for it to take effect.

## 4. Close the loop — set CORS on the backend

Back in Render, on the `averagepace-api` service → **Environment**:
- Set `CORS_ORIGINS` to the frontend URL from step 3
  (e.g. `https://averagepace-xxxx.vercel.app`)
- Save — Render redeploys automatically.

Done. Open the Vercel/Netlify URL — it should load and successfully submit
runs / show the leaderboard via the Render API.

## Known limits of this free setup

- Render's free web service sleeps after 15 min idle (cold start on wake).
- Neon/Supabase free Postgres caps storage around 0.5GB — plenty for a
  prototype leaderboard, not for real scale.
- No custom domain on any of these free tiers — you get a
  `.onrender.com` / `.vercel.app` / `.netlify.app` URL.
- None of this replaces the items in `README.md`'s "Known limitations"
  section (no auth, no rate limiting) — this just gets the app reachable
  on the internet, not production-hardened.
