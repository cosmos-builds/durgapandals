# Image assets

Drop files here with these exact names — the code already references these
paths, so nothing else needs to change once they exist.

| File | Used for | Where it's wired in | Notes |
|---|---|---|---|
| `logo.png` | Header wordmark | `components/top-header.tsx` | SVG preferred (crisp at any size). Rendered at a fixed height, width auto. |
| `marker-icon.svg` | Map pin | `components/map-home.tsx`, `components/pandal-detail.tsx` | Rendered bare on the map at 30×30px — no background circle/border behind it, so the icon itself needs to read as a complete pin (e.g. a lion or Durga's-eyes shape with its own silhouette/color), not a glyph meant to sit inside a badge. |
| `hero-durga.png` | Intro hero image | `components/intro-hero.tsx` | Shown first-visit-only, above the headline. PNG with transparency recommended if it's a cutout/illustration; a photo works too. |

`app/icon.png` (one level up, in `apps/web/app/`, not here) is the browser
tab favicon — Next.js auto-detects that exact file/location and wires up
the `<link rel="icon">` itself, so it can't live in this folder with the
others.

This file itself (`README.md`) is just documentation — delete it once real
images are in place, or leave it, it's harmless either way.
