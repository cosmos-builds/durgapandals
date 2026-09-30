"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchCities, resolveCity, type CitySearchResult } from "@/lib/api";

const DEBOUNCE_MS = 350;

// Shared by the city-selector sheet, the intro-hero search box, and Add
// Pandal's city step so "type a city, get live results across all of India
// (not just admin-curated ones), pick one" isn't implemented three times. A
// "nominatim" result has no City row yet — selectAndGo() creates one
// (idempotently) right before handing it off, per the "materialize at
// selection time" design.
//
// `onSelected`, when given, replaces the default "navigate to /{slug}"
// behavior with a callback carrying the resolved city instead — Add Pandal
// needs to stay on the same page and just record which city was chosen,
// not browse there.
export function useCitySearch(onSelected?: (city: { _id: string; slug: string; name: string; latitude: number; longitude: number; defaultMapZoom: number; activeFestivalYear: number }) => void) {
  const router = useRouter();
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setQuery(value: string) {
    setQueryState(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchCities(value);
      setResults(found);
      setLoading(false);
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function selectAndGo(result: CitySearchResult) {
    if (result.source === "db") {
      if (onSelected) {
        // The search endpoint doesn't carry defaultMapZoom (not needed for
        // display) — 10 matches the City schema's own default, same
        // fallback admin's city-combobox uses for the same reason.
        onSelected({ ...result, defaultMapZoom: 10 });
      } else {
        router.push(`/${result.slug}`);
      }
      return;
    }
    setResolving(true);
    try {
      const city = await resolveCity(result);
      if (city) {
        if (onSelected) onSelected(city);
        else router.push(`/${city.slug}`);
      }
    } finally {
      setResolving(false);
    }
  }

  return { query, setQuery, results, loading, resolving, selectAndGo };
}
