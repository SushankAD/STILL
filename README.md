# STILL

STILL is a mobile-first app with focus timers, photo-verified habits, and daily mood check-ins. Earn roots to grow your Seed Drop through five stages, revisit saved proof photos in your Collection, and share small wins anonymously in Society.

## Run the local demo

Install the dependencies and start the app from the repository root.

```sh
npm ci --prefix web
npm start
```

Open the local URL printed in the terminal. A fresh checkout runs in demo mode and saves progress in that browser.

## Account features

Signed-in users can sync progress, keep proof photos in Collection, and share small wins in Society. When you submit a photo for verification, STILL sends it to Google Gemini for review.

## Development

STILL uses React, TypeScript, and Vite. Install dependencies in `web/`; the root package only forwards development commands.

```sh
npm run check
```

This runs the tests, lint checks, TypeScript checks, and production build. Use `npm test`, `npm run lint`, `npm run typecheck`, or `npm run build` to run a check separately. `npm run preview` serves the production build locally.

## Source layout

- `web/src/main.tsx`: application entry point and global stylesheet import.
- `web/src/AuthGate.tsx`: account screens and session handling.
- `web/src/App.tsx`: application state, navigation, and main screens.
- `web/src/HabitProof.tsx`, `ProofPhotoInput.tsx`, and `CollectionImage.tsx`: evidence and photo components.
- `web/src/styles/`: base and account styles, Home, shared controls, habits, Focus, other screens, light theme overrides, and navigation. `index.css` sets their load order.
- `web/src/lib/`: API clients, timer, audio, and growth calculations.
- `web/public/`: app icons, five growth-stage images, manifest, and service worker. Public assets are copied into every build; keep only files used by the app.
- `web/tests/`: runnable app and verification tests.
- `web/supabase/`: database migrations, SQL checks, and proof verification functions. Shared habit policies are also imported by the frontend.

Keep feature styles in the matching stylesheet and shared controls in `components.css`. Preserve selector specificity and import order when moving rules. Historical prototypes and local design exports belong outside the active app; `outputs/`, `reference/`, and `private/` are ignored.

## Connected development

Copy `web/.env.example` to `web/.env.local` and supply the project's public Supabase URL and publishable or anon key to enable account features. Keep service credentials out of frontend environment variables. The proof verification function uses `GEMINI_API_KEY` configured as a Supabase function secret.

Apply the project's migrations and deploy its functions through the backend workflow before testing account features. `npm run check` runs local tests and builds the frontend; it does not apply migrations, deploy functions, or run the SQL checks against a database.
