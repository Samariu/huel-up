# HUEL//UP

A cyberpunk PWA for tracking Huel Black Edition consumption. You tap once per drink. A flavor mix you set in the background is logged with each tap. Bags in the cupboard are deducted automatically, and a stats screen shows count, kg of powder, protein, cost and streaks.

## Features

- **FUEL**: one big button. Each tap logs the current mix (default 2 scoops = 90 g) and shows an undo toast. Includes glitch FX, a synth blip, and vibration on Android.
- **MIX**: set scoops per flavor (half-scoop steps). Every tap uses this mix until you change it.
- **STOCK**: sealed, open and finished bags per flavor.
  - Open bags show an *estimated* amount left, based on 45 g/scoop. Scoops vary, and other people drinking from the same bags aren't tracked.
  - **Mark empty** at any time. The next sealed bag of that flavor opens automatically.
  - If the estimate hits 0 but powder is left, logging continues. Use **Set left** to correct it.
  - Open and finish dates are recorded for each bag.
- **Low-stock warning**: shown only when a flavor in your mix has **no sealed bag left** and its open bag is at or below the threshold you set in SYS.
- **STATS**: Today / 7d / 30d / all. Shows drinks, kg powder, protein, money spent, a 30-day chart, flavor breakdown, streaks and average bag lifetime. The history list supports edit and delete, and you can add a drink you forgot to log.
- **SYS**: three themes (Neon, Acid, Matrix), flavor label values (protein per 90 g, bag size, price), threshold, grams per scoop, haptics/sound, and JSON export/import.

> The seeded flavors (Vanilla, Chocolate, Banana) use **placeholder** label values. Fix them from your bag's label in SYS → FLAVORS.

## Data

Everything is stored in IndexedDB in the browser on your device. No server and no account. Clearing site data or uninstalling the app deletes it, so use **SYS → Export JSON** now and then.

## Install on your phone

1. Open the GitHub Pages URL (`https://<user>.github.io/huel-up/`).
2. On Android (Chrome), use menu → *Install app*. On iOS (Safari), use Share → *Add to Home Screen*.

Note: iOS doesn't allow web apps to vibrate, so haptics only work on Android.

## Develop

```bash
npm install
npm run dev       # http://localhost:5173/huel-up/
npm test          # domain logic unit tests
npm run build     # type-check + production build in dist/
npm run icons     # re-render PNG icons from public/icons/favicon.svg (needs Playwright)
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to the repository's default branch. One-time setup: **Settings → Pages → Source: GitHub Actions**. On a free GitHub plan, Pages requires the repository to be public.
