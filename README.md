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

STILL uses React, TypeScript, and Vite. Run the app tests, lint checks, and production build with the following commands.

```sh
npm --prefix web test
npm --prefix web run lint
npm run build
```
