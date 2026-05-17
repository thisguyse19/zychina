# CQ–XJ Trip Planner · 重庆 × 新疆 行程簿

Privacy-first static web planner for **Chongqing plus Xinjiang** over **fourteen draft days**. The UI stacks **简体 / English**, **budget in CN¥**, **Leaflet route pins**, editable copy, backups, checklist sorting by **city/region**, and PDF export — all without a backend.

**Content source:** `content/trip-data.json` (+ optional `content/flights-live.json` overlays). Bump `appVersion` + `versions[]` alongside copy changes.

**Version log:** regenerated from JSON via:

```bash
node scripts/generate-version-md.mjs
```

Current shipped version: **`1.0.0`** (reset series for this China fork).

---

## Features

| Area | What you get |
|------|----------------|
| Itinerary | `itinerary.chongqing[]` then `itinerary.xinjiang[]` (`day.date` blobs are **segment labels**, not calendars, until dates exist). |
| Maps | Pins from `mapsData.cq` / `mapsData.xj` + captured screenshots inside PDF exports. |
| Checklist | `clMeta[].tripCity` groups (`pre`, `cq`, `xj`). Sort preset migrates legacy `date` → `city`. |
| Pricing | Charts + DOM keys read `tripMeta.currencySymbol` (expects `¥`). |
| Dates later | Populate `tripCountdown.start/end` `{year,month,day}` whenever ready — countdown + wording can tighten automatically downstream. |

---

## Bilingual UX

Strings live under `ui.en` / `ui.zh`. Sidebar toggles `tripleUiLang` (`en`/`zh`). `Tx()` resolves `{en,zh}` objects embedded in itinerary, checklist, budgets, PDF seeds, etc. Static HTML hotspots use `.trip-lng--en/.trip-lng--zh` spans.

Adding new chrome text? Extend **both** language maps (`ui.en`, `ui.zh`) so nothing falls back visibly empty.

---

## Auth & backups

Gate password is salted SHA-256 in `js/app.js` (`china` demo secret + salt `CQXJ_planner_v1`). Matching remember-me probe lives inline in `index.html` beside `tripAuthToken` localStorage.

**Operational note:** swapping the passphrase requires hashing `password + _AS` exactly like `_hashInput` and updating BOTH `js/app.js` and the inline early script probe.

Encrypted offline backup blobs keep the **`triple-*` localStorage key namespace** intentionally — format stayed compatible so merges across forks stay predictable.

---

## PDF export

Runs fully client-side (`html2canvas` map stamps + iframe `print`). Section chrome leans on `pageSeed.pdf` bilingual objects; cost rows honor `catSlug` grouping like the on-screen table.

---

## Local dev

Static hosting only (GitHub Pages, `npx serve`, `python -m http.server`). Leaflet + Chart.js load from CDNs; trip JSON is fetched with `cache: 'no-store'`.

```bash
npx --yes serve -l 4173
# open http://127.0.0.1:4173
```

---

## Rebuilding China JSON (optional)

```bash
node scripts/build-china-trip-data.mjs
```

Edits often land faster by hand-tweaking `content/trip-data.json` (especially `pageSeed`, `checklist`, `mapsData`).

---

## One-off PDF block maintenance

`scripts/rewrite_pdf_block.py` can replace the `doExportPDF` HTML chunk if the template drifts again after large refactors.

---

## License / credits

Private friend build — respect image licenses on hot-linked Unsplash URLs when forking. Service worker cache id: `cqxj-planner-v1` in `sw.js`.
