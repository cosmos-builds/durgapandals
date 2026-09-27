import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generic link-preview card (WhatsApp/Facebook/Twitter) for any route that
// doesn't have its own more specific one — the pandal detail page overrides
// this with the pandal's own photo (see its own opengraph-image.tsx).
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          // satori (the ImageResponse renderer) can't parse a `background`
          // shorthand that mixes gradients with a trailing solid color —
          // backgroundColor + backgroundImage separately instead.
          backgroundColor: "#0F0C15",
          backgroundImage:
            "radial-gradient(60% 60% at 50% 0%, rgba(255,181,71,.28), transparent 70%), radial-gradient(50% 50% at 90% 100%, rgba(255,68,51,.25), transparent 70%)",
          padding: 64,
        }}
      >
        <div style={{ fontSize: 120, marginBottom: 8, display: "flex" }}>🪔</div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            color: "#F4EFF6",
            display: "flex",
            letterSpacing: -1,
          }}
        >
          durga<span style={{ color: "#FF4433" }}>pandals</span>
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            color: "#C4BCCB",
            display: "flex",
            textAlign: "center",
          }}
        >
          Discover Durga Puja pandals — map-first, no login needed
        </div>
      </div>
    ),
    { ...size }
  );
}
