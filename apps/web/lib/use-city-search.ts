"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchCities, resolveCity, type CitySearchResult } from "@/lib/api";

const DEBOUNCE_MS = 350;

// Shared by the city-selector sheet and the intro-hero search box so
// "type a city, get live results across all of India (not just admin-curated
// ones), pick one, navigate there" isn't implemented twice. A "nominatim"
// result has no City row yet — selectAndGo() creates one (idempotently) right
// before navigating, per the "materialize at selection time" design.
export function useCitySearch() {
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
      router.push(`/${result.slug}`);
      return;
    }
    setResolving(true);
    try {
      const city = await resolveCity(result);
      if (city) router.push(`/${city.slug}`);
    } finally {
      setResolving(false);
    }
  }

  return { query, setQuery, results, loading, resolving, selectAndGo };
}
