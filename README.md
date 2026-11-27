# STILL

STILL is a mobile-first app with focus timers, photo-verified habits, and daily mood check-ins. Earn roots to grow your Seed Drop through five stages, revisit saved proof photos in your Collection, and share small wins anonymously in Society.

## Features

- Focus timers with photo-based completion verification.
- Daily habits and mood check-ins.
- Seed Drop growth across five stages.
- A Collection for saved proof photos.
- Anonymous posts and reactions in Society.
- Light and dark themes.

## Getting started

Requires Node.js 24 or newer and npm. Run these commands from the repository root:

```sh
npm ci --prefix web
npm start
```

Open the local URL printed in the terminal. Without account configuration, STILL runs in demo mode and saves progress in your browser.

## Configuration

Account syncing and photo verification require a configured backend. Use [`web/.env.example`](web/.env.example) as the template for your local environment configuration.

Photos submitted for verification are sent to Google Gemini for review.

## Development

| Command | Purpose |
| --- | --- |
| `npm start` | Start the development server |
| `npm test` | Run local tests |
| `npm run lint` | Check code quality |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build |
| `npm run check` | Run tests, lint, type checks, and build |

These checks run locally and do not deploy the app or update a database.

## Project structure

- `web/src/` — React components, styles, and application logic.
- `web/public/` — Images, app icons, and other static assets.
- `web/tests/` — Application tests.
- `web/supabase/` — Database migrations and backend functions.

## Built with

React, TypeScript, Vite, and Supabase.
