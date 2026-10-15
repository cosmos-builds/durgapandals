import Link from "next/link";
import { JsonLd } from "./json-ld";
import type { PandalSummary } from "@/lib/api";

export interface CitySeoSectionProps {
  citySlug: string;
  cityName: string;
  year: number;
  pandals: PandalSummary[];
}

// Real, visible text on the list page — a search engine can only rank a
// page for "Durga Darshan {city}" / "Durga Puja {city} {year}" if those
// words (and the localities people search alongside them) are actually on
// it. The map page is a full-screen canvas with almost no text, so this
// page carries the keyword-bearing copy. Everything stated here is derived
// from the listed data — no invented dates or claims.
export function CitySeoSection({ citySlug, cityName, year, pandals }: CitySeoSectionProps) {
  const localityCounts = new Map<string, number>();
  for (const pandal of pandals) {
    if (pandal.locality) localityCounts.set(pandal.locality, (localityCounts.get(pandal.locality) ?? 0) + 1);
  }
  const localities = Array.from(localityCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name]) => name);

  const faqs = [
    {
      question: `How many Durga Puja pandals are there in ${cityName} in ${year}?`,
      answer: `${pandals.length} pandals are currently listed for ${cityName} in ${year}, and more are added as the community and organisers submit them.`,
    },
    {
      question: `Where can I do Durga Darshan in ${cityName}?`,
      answer: localities.length
        ? `Pandals are listed across ${localities.slice(0, 8).join(", ")} and other areas of ${cityName}. Open the map to see which ones are closest to you.`
        : `Open the map to see the pandals closest to you in ${cityName}.`,
    },
    {
      question: `How do I plan pandal hopping in ${cityName}?`,
      answer: `Use the map to see pandals near each other, open a pandal for its theme, photos, timings and directions, and save your favourites to build a route.`,
    },
  ];

  return (
    <section className="relative mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-28 pt-10 md:px-8 md:pb-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }}
      />
      <h2 className="font-display text-2xl font-extrabold tracking-tight">
        Durga Puja {year} in {cityName}
      </h2>
      <p className="font-body text-sm leading-relaxed text-ink-muted">
        Looking for Durga Puja (Durga Pooja) pandals in {cityName}? DurgaPandal.com lists {pandals.length} pandals for{" "}
        {year} with their themes, locations, timings and photos, so you can plan your Durga Darshan and pandal
        hopping in one place. Navratri and Durgotsav pandals are covered too.
      </p>

      {localities.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-base font-bold">Durga Puja pandals by area in {cityName}</h3>
          <ul className="flex flex-wrap gap-2">
            {localities.map((locality) => (
              <li key={locality} className="rounded-full bg-chip px-3 py-1 font-body text-xs text-ink-muted">
                {locality}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h3 className="font-display text-base font-bold">Frequently asked questions</h3>
        {faqs.map((faq) => (
          <div key={faq.question} className="flex flex-col gap-1">
            <h4 className="font-body text-sm font-bold">{faq.question}</h4>
            <p className="font-body text-sm leading-relaxed text-ink-muted">{faq.answer}</p>
          </div>
        ))}
      </div>

      <Link href={`/${citySlug}`} className="font-body text-sm font-bold text-brand">
        View all {cityName} pandals on the map →
      </Link>
    </section>
  );
}
