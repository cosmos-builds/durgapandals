// Next.js renders the nearest `loading.tsx` automatically while its route
// segment's Server Component(s) are fetching — including sibling-to-sibling
// navigation within the same layout (e.g. Map -> Explore -> Saved), which is
// exactly the "no indication anything is happening" gap being fixed here.
// No props, no data: this only ever needs to say "something is loading."
export function PageLoading() {
  return (
    <div className="flex min-h-[60dvh] w-full flex-col items-center justify-center gap-3">
      <span className="material-symbols-rounded animate-spin text-3xl text-brand">progress_activity</span>
      <span className="font-body text-sm text-ink-muted">Loading…</span>
    </div>
  );
}
