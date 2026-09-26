import type { Metadata } from "next";
import "./globals.css";

// Never indexed publicly (spec §34).
export const metadata: Metadata = {
  title: "DurgaPandals Admin",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
