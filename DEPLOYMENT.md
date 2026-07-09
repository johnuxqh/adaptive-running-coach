# Deployment

## Live site

- Live URL: https://johnuxqh.github.io/adaptive-running-coach/
- Hosting: GitHub Pages
- Build command: `npm run build`
- Output folder: `dist`

## Required GitHub Pages configuration

This project is hosted from the GitHub Pages subpath `/adaptive-running-coach/`, so Vite must be configured with:

```ts
base: '/adaptive-running-coach/'
```

The app uses `HashRouter` so client-side routes remain safe on GitHub Pages refreshes and direct navigation. Routes appear after the hash fragment, for example:

```text
https://johnuxqh.github.io/adaptive-running-coach/#/settings
```

## How to verify deployment

1. Install dependencies with `npm ci`.
2. Build locally with `npm run build`.
3. Inspect `dist/index.html` and confirm generated asset URLs start with `/adaptive-running-coach/assets/`.
4. Confirm `dist/index.html` references hashed production assets and does not reference `/src/main.tsx`.
5. Open the live URL and verify the app renders instead of a blank page.
6. Navigate to Settings and confirm the page renders under the hash route.
7. In browser developer tools, check the Network tab for missing JavaScript, CSS, or manifest files.

## Common blank-page causes

- Vite `base` is missing or is not set to `/adaptive-running-coach/`.
- The deployed `index.html` still points at `/src/main.tsx` instead of built hashed assets.
- Static assets are requested from the domain root, such as `/assets/...`, instead of `/adaptive-running-coach/assets/...`.
- The web app manifest path does not include the GitHub Pages base path.
- Browser cache is serving an older build after deployment.
- Client-side routing uses browser history paths that GitHub Pages cannot serve directly instead of hash-based routes.
