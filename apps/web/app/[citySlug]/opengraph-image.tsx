import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { fetchCityBySlug, fetchPandalsForCity } from "@/lib/api";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same reasoning as app/opengraph-image.tsx: read the bundled asset from
// disk rather than fetching it, since this route has no request/host to
// build a reliable absolute URL from.
async function loadHeroDataUrl() {
  const bytes = await readFile(join(process.cwd(), "public/images/hero-durga-og.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

// Covers every route under a city (map, explore, saved, add) unless a more
// specific opengraph-image exists further down the tree — the pandal detail
// page has its own (that pandal's own photo) that overrides this.
//
// Most cities have few or no pandals with an uploaded cover photo yet
// (nothing to show), so this prefers a real photo from that city's own
// pandals when one exists — a featured one first, since that's already the
// city's own "best foot forward" pick — and only falls back to the generic
// branded Durga artwork (same as the homepage card) when the city has no
// photos to show at all, instead of a flat gradient either way.
export default async function Image({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug).catch(() => null);
  const cityName = city?.name ?? citySlug;

  const pandals = await fetchPandalsForCity(citySlug).catch(() => []);
  const withPhoto = pandals.filter((p) => p.year?.coverImage);
  const coverImage = (withPhoto.find((p) => p.year?.featured) ?? withPhoto[0])?.year?.coverImage;

  const hero = coverImage ? null : await loadHeroDataUrl().catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#0F0C15",
          backgroundImage:
            "radial-gradient(60% 60% at 50% 0%, rgba(255,181,71,.28), transparent 70%), radial-gradient(50% 50% at 90% 100%, rgba(255,68,51,.25), transparent 70%)",
        }}
      >
        {coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt=""
              width={size.width}
              height={size.height}
              style={{ position: "absolute", inset: 0, objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                background: "linear-gradient(0deg, rgba(15,12,21,.95) 0%, rgba(15,12,21,.6) 45%, rgba(15,12,21,.25) 100%)",
              }}
            />
          </>
        ) : (
          hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              width={760}
              height={520}
              style={{ position: "absolute", right: -60, top: 55, objectFit: "contain" }}
            />
          )
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: coverImage ? "flex-end" : "center",
            padding: 64,
            // `width`, not `maxWidth` — satori's flex/text-wrap engine only
            // reliably wraps within an *explicit* width; with `maxWidth`
            // (no coverImage case) the title's last word overflowed this
            // box entirely and sat on top of the hero artwork instead of
            // wrapping under it.
            width: coverImage ? "100%" : 640,
            height: "100%",
          }}
        >
          <div
            style={{
              fontSize: coverImage ? 60 : 60,
              fontWeight: 800,
              color: "#F4EFF6",
              display: "flex",
              flexWrap: "wrap",
              textAlign: "left",
              lineHeight: 1.15,
            }}
          >
            <span style={{ marginRight: 16 }}>Durga Puja pandals in</span>
            <span style={{ color: "#FF4433" }}>{cityName}</span>
          </div>
          <div style={{ marginTop: 20, fontSize: 30, color: "#C4BCCB", display: "flex" }}>
            durgapandal.com · map-first, no login needed
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
