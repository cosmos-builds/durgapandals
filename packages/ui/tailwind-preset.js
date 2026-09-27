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
