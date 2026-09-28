import type { Metadata } from "next";
// globals.css must be bundled first — it starts with a font @import rule,
// and CSS requires @import to be the very first rule in the FINAL bundled
// stylesheet. Importing maplibre's CSS first would push the font import
// below other rules, and the browser silently drops it (see apps/web's
// layout.tsx, which hit this exact issue with the Material Symbols font).
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { ToastProvider } from "@durgapandals/ui";

// Never indexed publicly (spec §34).
export const metadata: Metadata = {
  title: "DurgaPandals Admin",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
