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

With Supabase configured, signed-in accounts use cloud habits, focus sessions, check-ins, and Society. Without Supabase configuration, STILL runs in local demo mode.

### Configure Supabase

1. Create a Supabase project.
2. Apply the migrations in `web/supabase/migrations/` in timestamp order. For an existing project, apply its pending migrations.
3. Copy `web/.env.example` to `web/.env.local` and fill in the project URL and publishable/anon key from the Supabase project settings. Never put the service-role key in the browser app or commit real keys.
4. In Supabase Auth URL settings, allow the local app URL (usually `http://localhost:5173`) for email confirmation redirects. Confirmation returns to the same origin where sign-up started, so a phone cannot reach a link targeting the laptop's `localhost`.
5. Start the app with `npm start`, create an account, and confirm the email if confirmation is enabled for the project.

### Enable habit verification

On an existing project, check which tables and functions are already present before pushing migrations. SQL run through the Dashboard can create the schema without recording a CLI migration. The habit-verification migration changes write permissions, so deploy the Edge Function and configure its secret before switching the database and web app to the new flow. Older web builds write habits directly and need to be refreshed after the switch.

Configure a Gemini key under **Edge Function secrets** as `GEMINI_API_KEY`. Using Supabase CLI v3 from `web/`, deploy `verify-proof`.

```bash
supabase functions deploy verify-proof --no-verify-jwt --use-api --remote=YOUR_PROJECT_REF
```

The function validates every request with Supabase Auth. It uses the Supabase-managed service role secret on the server. Gemini 3.1 Flash-Lite is the default model. Set `GEMINI_MODEL` as a server secret to select a compatible Gemini model that supports images and structured outputs. For local function serving, use `supabase functions serve verify-proof --no-verify-jwt --env-file supabase/.env.local` from `web/` with the local Supabase stack initialized and running. Keep Gemini credentials in Edge Function secrets or the ignored server env file. Rotate any key previously configured with a `VITE_` prefix.

STILL saves a validated verification policy per habit. The six quick-add habits use built-in policies. Custom habits get a generated policy when created or first opened after migration. Changing the name's meaning or target prepares a new policy. A signed-in account is required to verify evidence and earn habit roots. Timer or tracker exports can be attached as images. Habits have no native timer or direct tracker connection.

The app records a habit's time zone from the device when that habit is created or first verified. Sleep uses the previous local date of sleep onset. The social report uses the latest closed reporting window, with a default of midnight to midnight and zero minutes. Edit the habit to configure the usage limit or end time. Reports need a visible matching date and the relevant readings. Self-reported completions are labeled in progress. Submitted images are forwarded to Gemini for review. STILL saves a photo in Collection only when the user opts in after acceptance.

### Verify locally

```bash
npm --prefix web test
npm --prefix web run lint
npm --prefix web run typecheck
npm run build
```

The AI tests use deterministic mocked responses. To run the database assertions, apply the migrations to a disposable Supabase database and run `psql "$STILL_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f web/supabase/tests/habit_verification.sql`.
