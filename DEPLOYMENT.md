# Deploying AccessFlow — Atlas + Render + Vercel

No CI/CD or hosted deployment exists yet (see `backend/Phase-09.md`'s "Remaining work") — this is the first time this stack has been deployed anywhere outside a local dev machine. This doc is the step-by-step walkthrough; `render.yaml` (repo root) and `frontend-react/vercel.json` are the config files that make the Render/Vercel steps below mostly one-click.

**Order matters** — each step needs an output from the one before it:

```
1. MongoDB Atlas  →  connection string (MONGO_URI)
2. Render (backend) → needs MONGO_URI from step 1  →  produces the backend's public URL
3. Vercel (frontend) → needs the backend URL from step 2 (VITE_API_BASE_URL) → produces the frontend's public URL
4. Back to Render → add the Vercel URL from step 3 to CORS_ORIGINS, redeploy
```

You'll go back to Render once after Vercel exists — that's expected, not a mistake.

## Prerequisite fix already made

Cookies for the refresh token used to be `sameSite: 'lax'`. That works locally (frontend and backend are the same site — `localhost`, just different ports) but silently breaks once frontend and backend are on genuinely different domains (`*.vercel.app` vs. `*.onrender.com`) — the browser simply won't attach the cookie to the cross-origin `fetch` calls, so `/auth/refresh` and `/auth/logout` would 401 forever. Fixed in `backend/src/utils/cookies.ts`: `sameSite` is now `'none'` in production (paired with the `secure: true` it already had), `'lax'` in dev (unaffected). This needed a code change, not just config — deploying without it would look like login "doesn't stick" after a refresh, with no obvious cause.

## 1. MongoDB Atlas

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com) → **Create a new project** (e.g. "AccessFlow").
2. **Build a Database** → **M0 Free** tier → pick any region → name the cluster (e.g. `accessflow-cluster`).
3. **Database Access** → add a new database user (username/password auth) — save the password somewhere, you'll paste it into Render next, never into this repo.
4. **Network Access** → add IP address → **Allow access from anywhere** (`0.0.0.0/0`). Render's free-tier web services don't have a fixed outbound IP, so a narrower allow-list isn't workable without a paid Render static-IP add-on — access is still gated by the DB username/password.
5. **Connect** → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@accessflow-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>`/`<password>` with the values from step 3, and add a database name before the `?` — this app expects one (matches local dev's `.../accessflow`):
   ```
   mongodb+srv://<username>:<password>@accessflow-cluster.xxxxx.mongodb.net/accessflow?retryWrites=true&w=majority
   ```
   This full string is your `MONGO_URI` for the next step.

## 2. Render (backend)

1. Push this repo to GitHub if you haven't already (it already is — `github.com/gayathripriya99/AccessFlow`).
2. On [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint** → connect the `AccessFlow` repo. Render will detect `render.yaml` at the repo root and propose one service, `accessflow-backend`, rooted at `backend/`.
3. Before the first deploy, Render will prompt for the env vars marked `sync: false` in `render.yaml`:
   - `MONGO_URI` — paste the full Atlas connection string from step 1.
   - `CORS_ORIGINS` — leave as a placeholder for now (e.g. `http://localhost:5173`); you'll come back and set the real Vercel URL in step 4.
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are marked `generateValue: true` — Render generates two distinct random secrets itself; you never need to choose or see these.
4. Deploy. First build takes a few minutes (`npm install && npm run build`, then `npm start`).
5. Once live, note the service URL Render assigns, e.g. `https://accessflow-backend.onrender.com`. Verify it:
   ```bash
   curl https://accessflow-backend.onrender.com/api/v1/health
   ```
   Expect `{"status":"ok",...}`.

**Free-tier note:** Render's free web services spin down after ~15 minutes of no traffic and take 30–60s to wake on the next request — the first request after idle will look slow/timed out in a browser; that's the cold start, not a bug.

## 3. Vercel (frontend)

1. On [vercel.com/new](https://vercel.com/new), import the same GitHub repo.
2. **Root Directory** → set to `frontend-react` (this repo is a monorepo; Vercel needs to know which subfolder is the app). Framework preset should auto-detect as **Vite**.
3. **Environment Variables** → add:
   - `VITE_API_BASE_URL` = `https://accessflow-backend.onrender.com/api/v1` (the Render URL from step 2, with `/api/v1` appended — Vite only bakes `VITE_`-prefixed vars into the build at build time, so this must be set *before* deploying, not after).
4. Deploy. `frontend-react/vercel.json` (already in the repo) handles the SPA rewrite so client-side routes like `/dashboard` or `/roles` don't 404 on a hard refresh.
5. Note the assigned URL, e.g. `https://access-flow.vercel.app`.

## 4. Back to Render — close the loop

1. Render dashboard → `accessflow-backend` → **Environment** → edit `CORS_ORIGINS` to the real Vercel URL from step 3 (e.g. `https://access-flow.vercel.app` — no trailing slash, comma-separate if you have more than one, e.g. a preview-deployment domain too).
2. Save — Render redeploys automatically on an env var change.

## 5. Verify the live deployment

Same checklist as local dev (see [HOW_TO_RUN.md](HOW_TO_RUN.md) section 4), just against the two public URLs instead of `localhost`:

1. Open the Vercel URL → register a new org → confirm redirect to `/login`.
2. Log in → confirm the dashboard loads with the bootstrap admin's full permission set and the tenant name in the Sidebar.
3. Open the browser devtools Network tab, reload the page → confirm `/auth/refresh` succeeds (200, not 401) and the `Set-Cookie` response header shows `SameSite=None; Secure` — this is the direct proof the cookie fix above is actually working in the deployed environment, not just in theory.
4. Register a second org with the same email (proves per-tenant isolation still holds against the real Atlas cluster).
5. Confirm the browser console has no CORS errors — if `CORS_ORIGINS` is wrong, every API call fails with a CORS error, not a 401, which is the tell for "step 4 above wasn't done or has a typo."

## Rollback / redeploy

- **Render**: dashboard → the service → **Manual Deploy** → pick a previous commit, or just push a new commit to `main` (auto-deploys by default).
- **Vercel**: dashboard → the project → **Deployments** → any previous deployment → **Promote to Production**.
- **Atlas**: nothing to roll back here unless you changed the cluster tier/config; data itself isn't versioned — back up via Atlas's own snapshot feature if this ever holds real data you care about.

## What's still open after this

- No CI (no automated build/lint/test gate before a deploy goes live) — both Render and Vercel deploy directly off pushes to `main` with no test run in between.
- No staging environment — this walkthrough produces one production environment per service.
- No custom domain configured (both services get their default `*.onrender.com`/`*.vercel.app` URLs) — adding one is a dashboard step on either service, not a code change.
