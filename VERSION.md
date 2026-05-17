# CQ–XJ Planner — version history

**Shipped app version:** `1.1.1` (must match `content/trip-data.json` → `appVersion`).

This file lists every shipped version from newest to oldest. The **source of truth** is `content/trip-data.json` → `versions` (same strings power the in-app changelog, sidebar version pill, and “What’s new”).

After editing `versions` in JSON, regenerate this file:

```bash
node scripts/generate-version-md.mjs
```

---

## 1.0.0 — 2026-05-17

### Chongqing & Xinjiang relaunch — bilingual planner

- Initial China fork with city-based draft days.

## 1.1.0 — 2026-05-17

### June 11–23 Xinjiang road-trip itinerary (from route image)

- Full 13-day Jun 11–23 schedule: Singapore ↔ Chongqing ↔ Xinjiang Duku loop ↔ Singapore
- All route-card sights, hotels, and city chains preserved with bilingual copy
- Itinerary split by travel dates: Chongqing · Jun 14–19 north · Jun 20–23 south
- tripCountdown start/end set; checklist can sort by travel date again

## 1.1.1 — 2026-05-17 **· current release**

### Place photos & calendar date cards

- Day cards show calendar dates (Jun 12 / 6月12日) large; route text moves to subtitle
- Per-day and stay images use Unsplash photos geotagged to each location
- Section hero banners updated to match Chongqing, Duku, Sayram, and related stops

