import { PageLoading } from "@/components/page-loading";

// Covers Map <-> Explore <-> Saved: Next.js shows this for any navigation
// between sibling pages under this layout, not just a fresh page load —
// each of those pages does its own server-side pandal fetch, and there was
// previously nothing on screen while that was in flight.
export default function Loading() {
  return <PageLoading />;
}
