# CQ–XJ Planner — version history

**Shipped app version:** `1.0.0` (must match `content/trip-data.json` → `appVersion`).

This file lists every shipped version from newest to oldest. The **source of truth** is `content/trip-data.json` → `versions` (same strings power the in-app changelog, sidebar version pill, and “What’s new”).

After editing `versions` in JSON, regenerate this file:

```bash
node scripts/generate-version-md.mjs
```

---

## 1.0.0 — 2026-05-17 **· current release**

### Chongqing & Xinjiang relaunch — bilingual planner

- Full itinerary retarget to Chongqing and Xinjiang — city-based itinerary sections instead of Tasmania/Melbourne
- 简体中文 / English language toggle persisted in sidebar and backups
- Checklist grouping by city/region replaces travel-date grouping (dates kept ready in trip countdown for future use)
- Maps, budget (CN¥), accommodations, flights seed, tips, and copy aligned for travel in mainland China
- New app versioning series starting at 1.0.0; service worker cache id refreshed separately in sw.js

