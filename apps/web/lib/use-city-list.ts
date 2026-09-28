"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCitiesCached, type CityApiModel } from "@/lib/api";

// Shared by IntroHero and the CitySelectorSheet so "load the full city
// list" isn't fetched and error-handled twice — both previously called
// fetchCities() independently and had no error state at all, so a failed
// request just rendered zero city chips with no explanation.
export function useCityList() {
  const [cities, setCities] = useState<CityApiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback((force = false) => {
    setLoading(true);
    setError(false);
    fetchCitiesCached(force)
      .then(setCities)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { cities, loading, error, retry: () => load(true) };
}
