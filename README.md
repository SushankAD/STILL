# STILL

STILL is a mobile-first app for proof-based focus, habits, reflection, and quiet progress. It is being built as a Progressive Web App (PWA): one React app that works in a browser and can be installed from supported mobile browsers.

The project is a React + TypeScript application built with Vite. The original static prototype remains in `outputs/still-10-ui/` as a design reference.

## Run Locally

```bash
npm install --prefix web
npm start
```

Then open the local URL printed by Vite, usually `http://localhost:5173`.

## Check

```bash
npm run check
npm run build
```

These commands type-check and build the React app.

## Source

- `web/src/App.tsx` contains the React Phase 1 interface.
- `web/src/index.css` contains the global browser reset.
- `outputs/still-10-ui/` contains the original static prototype.
- `reference/still-app.jsx` contains the earlier React UI concept.

## Phase 2 Foundation

Phase 2 is adding the full-stack foundation while keeping the existing interface:

- The PWA manifest and service worker make the app installable and cache its static shell. Private data and API responses are deliberately not cached.
- Supabase provides authentication, a Postgres database, and private photo storage. Its generated REST API is the client/server boundary for the web app.
- `web/supabase/migrations/` contains the first schema migration for profiles, habits, completions, check-ins, focus sessions, and proof-photo metadata. Row-level security policies restrict private rows and files to their owner.

The current app screens still use the Phase 1 browser-local demo state. Authentication and syncing those screens with Supabase are the next implementation slice; setting environment variables alone does not switch the screens to cloud data.

### Configure Supabase

1. Create a Supabase project.
2. Run `web/supabase/migrations/20261125000000_phase_2_core.sql` in the Supabase SQL Editor.
3. Copy `web/.env.example` to `web/.env.local` and fill in the project URL and publishable/anon key from the Supabase project settings. Never put the service-role key in the browser app or commit real keys.
4. Start the app with `npm start`.

The project does not require Supabase credentials to build or run its current local demo.
