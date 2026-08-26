# STILL

STILL is a static mobile-first app UI for proof-based focus, habits, check-ins, anonymous society posts, and a date-wise photo collection.

## Run Locally

```bash
python3 -m http.server 8790 --directory outputs/still-10-ui
```

Then open `http://127.0.0.1:8790`.

No install step is required. The app uses plain HTML, CSS, and JavaScript with `localStorage`.

If your machine has Node/npm, `npm start` runs the same server command.

## Check

```bash
npm run check
```

This validates the JavaScript syntax. It requires Node on your PATH.

## Source

- `outputs/still-10-ui/index.html` is the app shell.
- `outputs/still-10-ui/app.js` contains state, rendering, rewards, proof uploads, collection, and society interactions.
- `outputs/still-10-ui/styles.css` contains the complete UI styling.
- `outputs/still-10-ui/assets/` contains the current STILL logo and social assets.

## Product Status

This is ready for team review as a polished static product UI. Before paid subscriptions or real users, replace `localStorage` with a backend, add authentication, create real photo storage, moderate anonymous society posts, and define privacy/safety policies.
