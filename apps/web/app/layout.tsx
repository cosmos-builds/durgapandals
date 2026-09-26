import type { Metadata } from "next";
// globals.css must be bundled first — it starts with @import font rules,
// and CSS requires @import to be the very first rule in the FINAL bundled
// stylesheet, not just its own source file. Importing maplibre's CSS first
// pushed the fonts (including the Material Symbols icon font) below other
// rules, so the browser silently dropped the @import and icons rendered as
// literal text ("location_off") instead of glyphs.
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "DurgaPandals.com",
  description: "Discover Durga Puja pandals in Bhopal and Indore — map-first, no login needed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
