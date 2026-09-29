// Design tokens reconciled with the 2026 redesign handoff
// (design_handoff_durgapandals_redesign) — dark-only, no theme switcher
// (spec §28.2). web and admin both extend this preset instead of
// redefining colors/type locally, so this single reconciliation carries
// through every screen automatically.
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      // Tailwind's default spacing scale has no "13" step, so every
      // `h-13`/`w-13`/etc. utility in the app (Button's base height, the
      // city-selector row) was silently generating no CSS at all — the
      // element fell back to whatever height its padding/line-height
      // produced instead of the intended 52px, which is exactly why button
      // heights (and their top/bottom padding) looked inconsistent across
      // the site instead of uniform.
      spacing: {
        13: "3.25rem",
      },
      colors: {
        ground: "#170810",
        // Sticky/nav-bar tone one shade darker than the page body (top
        // header, bottom nav, admin sidebar) — matches the redesign's two
        // ground shades instead of one flat background everywhere.
        "ground-deep": "#0F050A",
        surface: "#170810",
        panel: "#241019",
        card: "#241019",
        chip: "#341A28",
        border: "rgba(255,214,173,.1)",
        ink: "#FCEFE4",
        "ink-muted": "rgba(252,239,228,.55)",
        "ink-dim": "rgba(252,239,228,.75)",
        brand: {
          DEFAULT: "#FF4433",
          hover: "#FF7A3D",
          ink: "#FFF6EF",
        },
        accent: {
          DEFAULT: "#FFB547",
          ink: "#241019",
        },
        info: "#4DA3FF",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "sans-serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        card: "22px",
        sheet: "28px",
        pill: "9999px",
      },
    },
  },
};
