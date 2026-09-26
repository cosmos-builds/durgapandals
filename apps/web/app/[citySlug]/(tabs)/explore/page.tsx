import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchCityBySlug, fetchPandalsForCity } from "@/lib/api";

export default async function ExplorePage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const city = await fetchCityBySlug(citySlug);
  if (!city) notFound();

  const pandals = await fetchPandalsForCity(city.slug);
  const featured = pandals.filter((p) => p.year?.featured);

  return (
    <div className="relative min-h-dvh bg-ground pb-[100px] pt-[76px] md:pb-16">
      {/* Constrained + centered on desktop instead of stretching edge to edge */}
      <div className="mx-auto max-w-6xl md:px-8">
        <div className="px-4 md:px-0">
          <h1 className="font-display text-[34px] font-extrabold tracking-tight md:text-[40px]">Explore</h1>
        </div>

        {featured.length > 0 && (
          <div className="mt-6">
            <div className="flex items-baseline justify-between px-4 md:px-0">
              <h2 className="font-display text-xl font-extrabold">Featured this year</h2>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto px-4 pb-1 md:px-0">
              {featured.map((pandal) => (
                <Link
                  key={pandal.id}
                  href={`/${city.slug}/pandal/${pandal.slug}`}
                  className="relative h-[300px] w-[252px] flex-none overflow-hidden rounded-3xl"
                >
                  {pandal.year?.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pandal.year.coverImage} alt={pandal.canonicalName} className="absolute inset-0 h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ground via-ground/10 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1.5">
                    <span className="flex w-fit items-center gap-1 rounded-pill bg-accent px-2.5 py-1 font-body text-xs font-bold text-accent-ink">
                      <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        star
                      </span>
                      Featured
                    </span>
                    <span className="font-display text-xl font-bold leading-tight">{pandal.canonicalName}</span>
                    {pandal.organizerName && (
                      <span className="truncate font-body text-xs text-ink-dim">{pandal.organizerName}</span>
                    )}
                    <span className="flex items-center justify-between font-body text-sm text-ink-dim">
                      <span>{pandal.locality}</span>
                      <span className="flex items-center gap-1 font-bold text-accent">
                        <span className="material-symbols-rounded text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                          thumb_up
                        </span>
                        {pandal.likes}
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 px-4 md:px-0">
          <h2 className="font-display text-xl font-extrabold">All pandals · {pandals.length}</h2>
        </div>
        <div className="flex flex-col px-4 md:grid md:grid-cols-2 md:gap-3 md:px-0 lg:grid-cols-3">
          {pandals.map((pandal) => (
            <Link
              key={pandal.id}
              href={`/${city.slug}/pandal/${pandal.slug}`}
              className="flex items-center gap-3 border-b border-border py-3 md:rounded-2xl md:border md:border-border md:bg-panel md:p-3"
            >
              <div className="relative h-[68px] w-[68px] flex-none overflow-hidden rounded-2xl bg-card">
                {pandal.year?.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pandal.year.coverImage} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  {pandal.year?.featured && (
                    <span className="material-symbols-rounded flex-none text-sm text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                  )}
                  <span className="truncate font-body text-[16.5px] font-bold">{pandal.canonicalName}</span>
                  {pandal.verificationStatus === "VERIFIED" && (
                    <span className="material-symbols-rounded flex-none text-sm text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  )}
                </div>
                <span className="truncate font-body text-sm text-ink-muted">
                  {pandal.locality}
                  {pandal.organizerName ? ` · ${pandal.organizerName}` : ""}
                </span>
                {pandal.year?.theme && (
                  <span className="truncate font-body text-xs text-ink-dim">{pandal.year.theme}</span>
                )}
                {pandal.year && pandal.year.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {pandal.year.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-pill bg-chip px-2 py-0.5 font-body text-[11px] font-medium text-ink-dim">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <span className="mt-0.5 flex items-center gap-1 font-body text-sm font-semibold text-accent">
                  <span className="material-symbols-rounded text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    thumb_up
                  </span>
                  {pandal.likes}
                </span>
              </div>
            </Link>
          ))}
          {pandals.length === 0 && (
            <p className="py-8 text-center font-body text-ink-muted md:col-span-full">
              No pandals published yet in {city.name}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
