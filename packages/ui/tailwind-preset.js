// Design tokens straight from the approved DurgaPandals UI design file —
// dark-only, no theme switcher (spec §28.2). web and admin both extend this
// preset instead of redefining colors/type locally.
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        ground: "#0F0C15",
        surface: "#15121A",
        panel: "#18141F",
        card: "#221C2B",
        chip: "#2E2639",
        border: "rgba(255,255,255,.1)",
        ink: "#F4EFF6",
        "ink-muted": "#A79FB0",
        "ink-dim": "#C4BCCB",
        brand: {
          DEFAULT: "#FF4433",
          hover: "#FF7A64",
          ink: "#1A0710",
        },
        accent: {
          DEFAULT: "#FFB547",
          ink: "#1A0710",
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
