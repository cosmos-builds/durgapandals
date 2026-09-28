import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://durgapandal.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Same reasoning as sitemap.ts: submission forms and personal
      // saved-lists have no unique content worth crawling.
      disallow: ["/*/add", "/*/saved"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
