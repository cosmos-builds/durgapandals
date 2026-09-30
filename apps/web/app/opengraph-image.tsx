import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Read from disk (not `fetch`) — the only reliable way to pull a local
// /public asset into Satori's renderer here: this route has no incoming
// Request/host to build an absolute URL from, and NEXT_PUBLIC_SITE_URL
// isn't set in every environment (falls back to the production domain,
// which would make local/preview builds embed the *production* image —
// harmless for a static asset, but fragile and slow for no reason next to
// just reading the file that's already sitting right there).
async function loadHeroDataUrl() {
  const bytes = await readFile(join(process.cwd(), "public/images/hero-durga-og.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

// Generic link-preview card (WhatsApp/Facebook/Twitter) for any route that
// doesn't have its own more specific one — the pandal detail page overrides
// this with the pandal's own photo, and the city page with a real pandal
// photo from that city when one exists (see their own opengraph-image.tsx
// files). This one previously had no photo at all, just an emoji + text —
// this is the same festive Durga artwork already used on the app's own
// intro screen (see intro-hero.tsx), sized down for OG use.
export default async function Image() {
  const hero = await loadHeroDataUrl().catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          // satori (the ImageResponse renderer) can't parse a `background`
          // shorthand that mixes gradients with a trailing solid color —
          // backgroundColor + backgroundImage separately instead.
          backgroundColor: "#0F0C15",
          backgroundImage:
            "radial-gradient(60% 60% at 50% 0%, rgba(255,181,71,.28), transparent 70%), radial-gradient(50% 50% at 90% 100%, rgba(255,68,51,.25), transparent 70%)",
        }}
      >
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            width={760}
            height={520}
            style={{ position: "absolute", right: -60, top: 55, objectFit: "contain" }}
          />
        )}

        {/* `width`, not `maxWidth` — satori only reliably wraps text within
            an explicit width (see the city-level opengraph-image.tsx for
            the bug this caused there: a maxWidth let the last word overflow
            onto the hero artwork instead of wrapping under it). */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 64, width: 680 }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#F4EFF6", display: "flex", letterSpacing: -1 }}>
            durga<span style={{ color: "#FF4433" }}>pandals</span>
          </div>
          <div style={{ marginTop: 20, fontSize: 30, color: "#C4BCCB", display: "flex", flexWrap: "wrap" }}>
            Discover Durga Puja pandals — map-first, no login needed
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
