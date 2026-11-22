# STILL

STILL is a mobile-first app for proof-based focus, habits, reflection, and quiet progress.

The first development phase is a React + TypeScript application built with Vite. The original static prototype remains in `outputs/still-10-ui/` as a design reference.

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

## Product Status

Phase 1 provides a working React, TypeScript, and Vite foundation.

Future phases will add browser persistence, Supabase authentication and data storage, photo uploads, PWA installation, notifications, moderation, and native packaging.
