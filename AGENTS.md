## Cursor Cloud specific instructions

This is a **zero-dependency static PWA** — no `package.json`, no build step, no backend, no database.

### Running the app

Serve the repo root with any static HTTP server. `fetch()` of JSON data files will fail on `file://`.

```bash
npx --yes serve -l 4173
# open http://127.0.0.1:4173
```

The password gate uses SHA-256; the demo passphrase is `china` (salt `CQXJ_planner_v1`).

### Linting / testing

There is no linter, test runner, or build toolchain configured in this repo. Validation is manual: serve the site and verify features in a browser.

### Utility scripts (optional)

These Node.js scripts regenerate content/data files — they are **not** required to run the app:

| Script | Purpose |
|--------|---------|
| `node scripts/generate-version-md.mjs` | Regenerate `VERSION.md` from `trip-data.json` |
| `node scripts/build-airports.mjs` | Rebuild `content/airports.json` from bundled data |
| `node scripts/build-china-trip-data.mjs` | Rebuild `content/trip-data.json` from embedded seed |

### Key architectural notes

- All libraries (Leaflet, Chart.js, html2canvas, Google Fonts) load from CDNs — internet access is required on first load; the Service Worker caches them for offline use.
- All user state is stored in `localStorage` under the `triple-*` key namespace.
- The single monolithic `js/app.js` (~3,800 lines) contains all application logic.
- `content/trip-data.json` is the single source of truth for all trip content.
