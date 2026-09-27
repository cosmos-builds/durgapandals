# durgaPandals — New Feature Spec (for engineering handoff)

Scope: features requested in the redesign that don't exist in the current codebase (apps/web, apps/admin). Written so another engineer/AI can implement directly against the existing data model (Pandal, PandalSubmission, City) in the repo `cosmos-builds/durgapandals`.

## 1. Pandal model — new fields
Add to `Pandal` (and the equivalent `PandalSubmission.submittedData`):
- `verified: boolean` — set true only by admin action (not organizer self-report). Show a verified checkmark badge next to the name when true.
- `addedBy: "ADMIN" | "ORGANIZER" | "PUBLIC_SUBMISSION"` — drives the "Added by organiser / Added by admin" attribution line on the detail page.
- `parkingAvailable: boolean`
- `twoWheelerAccessible: boolean`
- `fourWheelerAccessible: boolean`
- `foodStallsNearby: boolean`
- `streetShopsNearby: boolean`
- `visitType: "WALKING_DARSHAN" | "PARK_AND_VISIT" | "DARSHAN_AND_GO"`
- `schedule: { time: string, label: string }[]` — **free-length array, 0 to N entries**. Do not template a fixed set of events (Sandhya Aarti / Dhunuchi Naach / etc.) — many pandals only run a morning + evening aarti and nothing else. The Add Pandal form should let organizers add/remove rows freely (repeatable field group), defaulting to empty.
- `likeCount: number` + a `PandalLike { userId/deviceId, pandalId }` join for idempotent likes. Replaces the previous star-rating concept — the product intentionally has no numeric rating; only likes.
- `festivalYear: number` (if not already tracked per-listing — confirm against existing `activeFestivalYear` handling in add-pandal-flow.tsx; every listing must be explicitly tied to a year, and the UI must let a user pick a year, not just implicitly use "current").

## 2. Pandal detail page — new sections
- Verified badge (icon next to name, tooltip "Verified by admin").
- Attribution line under locality: "Added by {addedBy}".
- Replace the star-rating chip with a **Like button** (heart icon + `likeCount`, tap to like/unlike — no numeric rating anywhere).
- "Good to know" grid: parking, 2W/4W access, food stalls, street shops — only render entries that are true (don't show a false amenity as a dim/crossed-out item).
- "Visit type" chip (Walking darshan / Park & visit / Darshan & go).
- "Pandals near here (1–2km)" horizontal list — query pandals within a 1–2km radius of the current pandal's lat/lng (reuse the existing `fetchNearbyPandals`-style geo query, radius param instead of the fixed dedup radius).
- Puja schedule renders `schedule` as-is (0..N rows) with no minimum — show the whole section only if `schedule.length > 0`.

## 3. Add Pandal flow — restructure
- Split the form into two visually distinct groups: **Basic details** (city + festival year, location, name, organiser, locality, landmark, address) and **Optional details** (categories, parking/accessibility/food/shops booleans, visit type, schedule rows, photos).
- Location step must offer **both**: "Use my current location" (browser Geolocation API, falls back gracefully with a permission-denied message) and the existing drag-the-map-pin flow. Add a "Search this area" affordance on the map (re-run the nearby/duplicate query for the map's current center instead of only on `moveend` debounce — matches the Google-Maps-style pattern requested).
- **Mobile must show the map** in this flow (current gap: the mobile step had no location/map UI). Give it its own compact map card (~140–180px) with the search-this-area control, above the city/year card.
- Festival year becomes an explicit `<select>` in the Basic section (populate from active + previous festival years), not just inherited from `activeFestivalYear` silently.

## 4. Home / map screen
- Remove the "Sandhya Aarti in 40 min" banner — it assumed a fixed daily aarti that not all pandals have; a global home-screen banner about it is misleading. (Aarti timing now lives per-pandal in `schedule`.)
- Add a **"Search this area"** button that appears over the map (Google-Maps pattern) and re-queries pandals for the current viewport center — don't rely solely on auto-refetch on pan.
- Combine city + festival year into a single compact control (`📍 Kolkata · 2026 ▾`) instead of two separate inputs, to avoid cluttering the header. Opening it should show: a searchable city list (major cities pinned/pre-listed, all others reachable by typing) and a year selector.
- City list needs a `tier: "MAJOR" | "MINOR"` (or `featured: boolean`) flag on the City model so the picker can show majors by default and surface minors only via search — this generalizes the current Bhopal/Indore-only hardcoding to any number of cities.

## 5. Consistent branding
- App logo (not just a generic icon) appears in the header/nav on **every** screen, mobile and desktop — onboarding, home, explore, detail, add-pandal. Desktop uses a persistent top nav bar (logo + city/year + search + primary nav links) instead of the mobile bottom-tab-bar pattern.

## 6. Carried over from the first pass (still open)
- Uniform Button/Input usage across web + admin (no ad-hoc full-width stray fields).
- Admin Add Pandal: two-column card layout, city is searchable/any-city (not a fixed dropdown of two cities).
- Push notifications (nearby-pandal / aarti-time alerts) — not yet spec'd in detail, flagged as a future feature.
- Multi-language (Hindi/Bengali) — not yet spec'd in detail, flagged as a future feature.
