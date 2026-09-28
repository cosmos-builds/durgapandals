import { ImageResponse } from "next/og";
import { fetchCityBySlug } from "@/lib/api";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Covers every route under a city (map, explore, saved, add) unless a more
// specific opengraph-image exists further down the tree — the pandal detail
// page has its own (photo + pandal name) that overrides this.
export default async function Image({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  // If the API is briefly unreachable, the link preview should still render
  // (with a name-only fallback) instead of failing outright and giving
  // WhatsApp/Facebook nothing to show at all.
  const city = await fetchCityBySlug(citySlug).catch(() => null);
  const cityName = city?.name ?? citySlug;

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
          // See app/opengraph-image.tsx — satori can't parse a `background`
          // shorthand mixing gradients with a trailing solid color.
          backgroundColor: "#0F0C15",
          backgroundImage:
            "radial-gradient(60% 60% at 50% 0%, rgba(255,181,71,.28), transparent 70%), radial-gradient(50% 50% at 90% 100%, rgba(255,68,51,.25), transparent 70%)",
          padding: 64,
        }}
      >
        <div style={{ fontSize: 100, marginBottom: 4, display: "flex" }}>🪔</div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#F4EFF6",
            display: "flex",
            textAlign: "center",
          }}
        >
          Durga Puja pandals in <span style={{ color: "#FF4433", marginLeft: 16 }}>{cityName}</span>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            color: "#C4BCCB",
            display: "flex",
          }}
        >
          durgapandal.com · map-first, no login needed
        </div>
      </div>
    ),
    { ...size }
  );
}
