import type { Metadata } from "next";
// globals.css must be bundled first — it starts with @import font rules,
// and CSS requires @import to be the very first rule in the FINAL bundled
// stylesheet, not just its own source file. Importing maplibre's CSS first
// pushed the fonts (including the Material Symbols icon font) below other
// rules, so the browser silently dropped the @import and icons rendered as
// literal text ("location_off") instead of glyphs.
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://durgapandals.com";
const SITE_DESCRIPTION = "Discover Durga Puja pandals in Bhopal and Indore — map-first, no login needed.";

// Site-wide link-preview defaults (WhatsApp/Facebook/Twitter card) — every
// route inherits these unless it exports its own `metadata`/`generateMetadata`
// and/or its own `opengraph-image` file (Next.js's file-based convention;
// see app/opengraph-image.tsx and the per-pandal one under
// app/[citySlug]/pandal/[slug]/), which is how the pandal detail page gets
// its own photo in the preview instead of this generic one.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DurgaPandals.com",
    template: "%s · DurgaPandals.com",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    siteName: "DurgaPandals.com",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
