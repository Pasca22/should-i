# Should I?

Draw a route on the map and ask **Jev** ([TypeSafe](https://typesafe.ai)'s System One model) whether the weather is right
for it. The forecast comes from [Open-Meteo](https://open-meteo.com); Jev turns it into a verdict (**Go run**, **Your
call**, **Skip it**) plus the conditions, the best time to start, and what to wear.

Sports: **Run** (available). **Hike** is coming; see [Hiking](#hiking).

The app is a closed beta: Google sign-in, an invite list, and per-tester limits.

## Stack

| | |
|---|---|
| App | Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), Leaflet via react-leaflet, OpenStreetMap tiles |
| Data | Postgres 18 (Docker locally, Neon in production), Drizzle ORM + drizzle-kit, postgres.js |
| Auth | Better Auth with Google |
| AI / weather | TypeSafe System One API (Jev), Open-Meteo forecast and air-quality APIs (no key) |

## Run it locally

Requirements: **Node 22+** and **Docker**.

```powershell
npm install
copy .env.example .env.local   # then fill it in, see below
npm run db:up                  # Postgres 18 on localhost:5440
npm run db:migrate             # create the tables
npm run dev                    # http://localhost:3000
```

### Environment (`.env.local`)

| Variable | What |
|---|---|
| `DATABASE_URL` | `postgres://should_i:should_i@localhost:5440/should_i` for the Docker database |
| `TYPESAFE_API_KEY` | TypeSafe API key; server-side only |
| `JEV_MODEL` | Optional, default `jev-latest` |
| `BETTER_AUTH_SECRET` | Signs session cookies. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `BETTER_AUTH_URL` | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | A Google OAuth "Web application" client (see below) |
| `ADMIN_EMAILS` | Comma-separated Google accounts that are admins |

**Google sign-in locally:** in Google Cloud Console → Google Auth Platform → Clients, create a *Web application* client with
origin `http://localhost:3000` and redirect URI `http://localhost:3000/api/auth/callback/google`. Open the app at exactly
`http://localhost:3000` (not `127.0.0.1`), or Google answers `redirect_uri_mismatch`.

**Location** works on `localhost` (browsers treat it as secure). A phone on your Wi-Fi (`http://192.168.x.x`) can't use it;
the deployed HTTPS site can.

### Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript |
| `npm run db:up` | Start Postgres in Docker |
| `npm run db:generate` | Write a migration after changing `src/shared/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:studio` | Browse the database in the browser |

## How a check works

1. **Mark where you'll run** by tapping the map: one point = a run around that spot, several = the area the run
   covers. The points don't need to trace the exact path; they only tell Jev where to read the weather. Drag a point
   to move it, tap it to remove it. The map starts at your location (asked once per visit) and remembers the last view.
2. **Plan** (optional): the day (today up to 7 days ahead), the start time and the run length, on scroll wheels. Left on
   "any", Jev picks the best window.
3. **Should I run?**: the server (`POST /api/run/check`)
   - reserves one of the tester's daily checks by inserting the `checks` row first (under a per-user Postgres
     advisory lock, so parallel requests can't slip past the limit); a check that fails is given back,
   - samples up to **8 forecast points** along the route (start, about every 1.5 km, finish; a loop's finish is skipped),
   - fetches weather and air quality for all of them in **one batched Open-Meteo request each**, cached per point for
     10 minutes in Postgres (`weather_cache`),
   - picks the forecast steps that overlap the run (15-minute steps for runs up to 3 h, hourly otherwise),
   - asks Jev one request with these questions: `go_run` (noul), `conditions` (score 0–4), `when` (choice of start
     windows, or keep the planned start), `rain_gear`, `warm_layers`, and `right_now` (today, no start set),
   - fills in the reserved row (state, answers, tokens).
4. **Result**: the verdict (Go run ≥ 65%, Skip it < 35%), the tiles, the forecast during the run and per point. The
   route line takes the verdict's colour.

If air quality is unavailable the check continues without it. Weather or Jev failures show an error card with what to
do and, where it helps, **Try again**.

## Closed beta

- **Sign-in** is Google only, and only for admins (`ADMIN_EMAILS`) and invited accounts. Better Auth's database hooks
  refuse everyone else when the user or session would be created; they land on `/login` with an "invite-only" message.
- **`/admin`** (admins only, in the avatar menu as *Beta admin*):
  - **People:** invite or remove a Google account, see who joined, their checks in the last 24 h, total checks, Jev
    tokens and last check. Removing someone ends their sessions immediately.
  - **Feedback:** what testers sent from **Send feedback** (avatar menu, `/feedback`, up to 1000 characters), sorted by
    Jev into **Bad / Neutral / Good**. If Jev was down, the entry waits under "Not sorted yet" with **Sort with Jev**.
    **Acknowledge** moves an entry off the open list; under **Show acknowledged** you can **Reopen** it, **Delete** it,
    or **Delete all acknowledged** to keep the table small. Open feedback can't be deleted.
- **Tester limits** (`src/shared/beta.ts`, `src/shared/feedback.ts`): 50 checks per rolling 24 hours, 20 route points
  per check, 5 feedback entries per 24 hours. Admins are unlimited.

## Project structure

```
src/
  app/                       routes: run/, hike/, login/, feedback/, admin/ (+ feedback/), api/run/check, api/auth
  proxy.ts                   session check before pages (Next 16's middleware)
  shared/                    used by every sport
    auth/                    Better Auth server config + browser client
    db/                      Drizzle schema (auth-schema.ts is generated by Better Auth) + client
    weather/                 Open-Meteo client: batching, Postgres cache
    jev.ts, errors.ts        Jev client; error types and friendly messages
    beta.ts, feedback.ts     invite list, limits, feedback sorting
    ui/                      app frame (map + panel), map, account menu, error card
    sports.ts                the list of sports
  sports/run/                everything specific to running
    route.ts                 forecast points along a drawn route
    forecast.ts              forecast rows and the run window
    questions.ts             the Jev questions (wording is tuned; change with care)
    check.ts                 one check: validate, fetch, ask Jev, record
    ui/                      run screen, plan form, results, map layers
  components/ui/             shadcn components, plus wheel-picker.tsx
drizzle/                     migrations (committed)
```

**Adding a sport:** add it to `src/shared/sports.ts`, create `src/sports/<id>/` (route model, state, questions, UI) and
`src/app/<id>/`. The database stores the sport as plain text, so no migration is needed for the sport itself.

## Deploy (Vercel + Neon)

1. **Neon:** create a project (e.g. AWS Frankfurt). Note the **pooled** connection string (host has `-pooler`) for the
   app and the **direct** one for migrations.
2. **Migrate Neon** from your machine (an env variable you set beats `.env.local`):
   ```powershell
   $env:DATABASE_URL = "<direct Neon URL>"; npx drizzle-kit migrate; Remove-Item Env:DATABASE_URL
   ```
   Do this again before deploying any change that adds a migration.
3. **Google:** a production *Web application* client with origin `https://<your-domain>` and redirect
   `https://<your-domain>/api/auth/callback/google`. Publish the app (*Audience → In production*); the invite list
   controls access from then on.
4. **Vercel:** import the repo and set `DATABASE_URL` (pooled), `TYPESAFE_API_KEY`, `BETTER_AUTH_SECRET` (a new one),
   `BETTER_AUTH_URL` (`https://<your-domain>`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ADMIN_EMAILS`. Set
   *Functions → Region* close to the database (e.g. `fra1`). Every push to `main` deploys.

Preview deployments get other URLs, so Google sign-in only works on the production domain.

## Notes

- **Free tiers:** Open-Meteo's free API and Vercel Hobby are for non-commercial use. OpenStreetMap's tile servers are
  fine at beta traffic; use a tile provider if it grows.
- **Next.js keeps pages mounted** when you navigate away (React `<Activity>`). The map remounts itself when a page comes
  back (see `src/shared/ui/MapView.tsx`), because react-leaflet can't survive being hidden.
- **Generated files:** `AGENTS.md` is rewritten by `next dev`; commit it. `src/shared/db/auth-schema.ts` is generated
  by `npx auth generate`; regenerate it rather than hand-editing it.

## Hiking

Not built yet. This section will describe hiking (trails, weather along the trail at elevation, hiking-specific Jev
questions) once it exists.
