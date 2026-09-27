import { ImageResponse } from "next/og";
import { fetchCityBySlug, fetchPandalDetail } from "@/lib/api";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The actual payoff of this whole file convention — sharing a specific
// pandal's link now shows ITS photo + name in the WhatsApp/Facebook/Twitter
// preview instead of a generic site card.
export default async function Image({ params }: { params: Promise<{ citySlug: string; slug: string }> }) {
  const { citySlug, slug } = await params;
  // If the API is briefly unreachable, fall back to the generic branded
  // card (below) instead of failing the whole link preview outright.
  const city = await fetchCityBySlug(citySlug).catch(() => null);
  const pandal = city ? await fetchPandalDetail(city._id, slug).catch(() => null) : null;
  const coverImage = pandal?.year?.coverImage;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0F0C15",
        }}
      >
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt=""
            width={size.width}
            height={size.height}
            style={{ position: "absolute", inset: 0, objectFit: "cover" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: coverImage
              ? "linear-gradient(0deg, rgba(15,12,21,.95) 0%, rgba(15,12,21,.55) 45%, rgba(15,12,21,.15) 100%)"
              : "radial-gradient(60% 60% at 50% 0%, rgba(255,181,71,.28), transparent 70%), radial-gradient(50% 50% at 90% 100%, rgba(255,68,51,.25), transparent 70%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 48,
            left: 56,
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            fontWeight: 800,
            color: "#F4EFF6",
          }}
        >
          durga<span style={{ color: "#FF4433" }}>pandals</span>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 56,
            right: 56,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {pandal?.verificationStatus === "VERIFIED" && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                background: "#FFB547",
                color: "#1A0710",
                fontSize: 22,
                fontWeight: 700,
                padding: "6px 18px",
                borderRadius: 999,
                marginBottom: 16,
              }}
            >
              ✓ Verified
            </div>
          )}
          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, color: "#F4EFF6", lineHeight: 1.1 }}>
            {pandal?.canonicalName ?? slug.replace(/-/g, " ")}
          </div>
          {pandal?.locality && (
            <div style={{ display: "flex", fontSize: 32, color: "#C4BCCB", marginTop: 12 }}>{pandal.locality}</div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
