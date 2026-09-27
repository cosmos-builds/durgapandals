# Handoff: durgaPandals Web + Admin Redesign

## Overview
Mobile-first (90% of traffic) + desktop redesign of the durgaPandals customer app and admin dashboard, plus new features (likes, verified badges, geotagging, flexible puja schedules, city/year selection, Basic/Optional add-pandal form). Repo: `cosmos-builds/durgapandals`.

## About the Design Files
The `.dc.html` files here are **design references built in HTML**, not production code to paste in. They render standalone in a browser for review. The task is to **recreate these designs inside the real Next.js codebase** (`apps/web`, `apps/admin`), using its existing patterns: Tailwind classes from `packages/ui/tailwind-preset.js`, the shared `Button`/`Input`/`Card` components in `packages/ui/src`, MapLibre via `@durgapandals/maps/react`, and the existing data model (`Pandal`, `PandalSubmission`, `City`).

## Fidelity
**High-fidelity for layout, spacing, color, and copy.** Colors/type should map directly onto the existing design tokens (brand red `#FF4433`, accent marigold `#FFB547`, Bricolage Grotesque + DM Sans, dark ground `#170810`/`#0F050A`) — these are close to, but slightly refined from, the current `packages/ui/tailwind-preset.js`; reconcile before implementing (e.g. confirm exact `--color-ground` etc.). Data shown (pandal names, like counts, schedule times) is placeholder — wire to real API calls (`lib/api.ts`, `lib/admin-api.ts`).

## Screens
See `Customer App Redesign.dc.html` (switch screens via the top tab bar: Onboarding, Home/Map, Explore, Pandal Detail, Add Pandal — each shown as an explicit **Mobile 390×844** frame and **Desktop 1280×800** frame side by side) and `Admin Redesign.dc.html` (sidebar nav: Dashboard, Pandals, Add Pandal, Submissions, Cities, Login).

Key layout notes:
- Mobile: bottom tab bar (Home/Explore/Add/Saved/Profile), map screens use a full-bleed map + bottom sheet pattern, single-column forms.
- Desktop: persistent top nav bar (logo + city/year + search + nav links) replacing the bottom tab bar; Home/Explore/Detail/Add-Pandal switch to split layouts (sidebar+map, filter-rail+grid, two-column detail, two-column form+map).
- Admin: fixed left sidebar, card-grid dashboard, table-based Pandals list, two-column Add Pandal form (was full-width/stretched before).

## New Features (not in current codebase)
Full spec in `FEATURES_SPEC.md` — read this first. Summary:
1. Pandal model: `verified`, `addedBy`, `parkingAvailable`, `twoWheelerAccessible`, `fourWheelerAccessible`, `foodStallsNearby`, `streetShopsNearby`, `visitType`, `schedule[]` (free-length, not fixed template), `likeCount` (+ `PandalLike` join), `festivalYear`.
2. Detail page: verified badge, attribution line, Like button (replaces star ratings entirely — do not add numeric ratings back), "Good to know" amenities grid, visit-type chip, "Pandals near here (1–2km)" radius query.
3. Add Pandal: Basic/Optional section split, "Use my current location" (Geolocation API) alongside manual pin drop, map now present on mobile too, "Search this area" re-query button, explicit festival-year `<select>`.
4. Home: removed the fixed "Sandhya Aarti" banner (schedules vary per pandal, this assumed one for all), added "Search this area" map button, combined city+year into one compact control, City model needs a `tier: MAJOR|MINOR` flag so major cities are pinned and minor ones are search-only (generalizes past the Bhopal/Indore-only hardcoding).
5. Logo present in the header on every screen, mobile and desktop.

## Interactions & Behavior
- Screen/tab switching in the mockup is just local component state — in the real app these are real routes (`/[citySlug]/(tabs)/...` etc., already present).
- "Search this area" buttons: re-run the existing nearby/duplicate-check query for the map's current center on click (don't rely only on debounced `moveend`).
- Like button: optimistic toggle, one like per user/device (`PandalLike` join, unique on `userId/deviceId + pandalId`).
- Geolocation button: use browser `navigator.geolocation.getCurrentPosition`, handle permission-denied with a visible fallback message (don't fail silently).

## Design Tokens (as used in the mockups)
- Ground: `#170810` / `#0F050A` (nav/sticky bars)
- Panel/card: `#241019`, chip/border accents `#341A28`
- Brand: `#FF4433` (primary actions, crowd-high, like icon)
- Accent: `#FFB547` (marigold — verified badge, secondary highlights)
- Text: `#FCEFE4` (primary), `rgba(252,239,228,0.5–0.75)` (muted tiers)
- Light input fields: background `#FCEFE4`, text `#241019` (inverted light-on-dark, matches existing `Input` component)
- Type: `Bricolage Grotesque` 700/800 (display/headings), `DM Sans` 400–700 (body)
- Radius: 11–18px on cards/inputs, 999px pills for chips/buttons/nav
- Icons: Material Symbols Rounded

## Assets
- `assets/logo.png` — user-provided durgaPandals logo (Durga face icon)
- `assets/hero-durga.png` — user-provided hero/onboarding artwork
- `assets/marker-icon.svg` — user-provided map pin icon
All three are real brand assets — carry them into the codebase's asset pipeline (e.g. `apps/web/public/images/`) as-is.

## Files
- `Customer App Redesign.dc.html` — customer app, all 5 screens × mobile/desktop
- `Admin Redesign.dc.html` — admin dashboard, all 6 screens
- `FEATURES_SPEC.md` — new feature spec, read before implementing
- `assets/` — logo, hero image, marker icon
