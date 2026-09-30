"use client";

import { useEffect, useRef, useState } from "react";
import type { CitySearchResult } from "@durgapandals/types";
import { Input, Badge } from "@durgapandals/ui";
import { searchCities, resolveCity, type ResolvedCity } from "@/lib/admin-api";

export interface SelectedCity {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  defaultMapZoom: number;
}

export interface CityComboboxProps {
  value: SelectedCity | null;
  onSelect: (city: SelectedCity) => void;
}

const DEBOUNCE_MS = 350;

function toSelectedCity(result: Extract<CitySearchResult, { source: "db" }>): SelectedCity {
  // The search endpoint doesn't carry defaultMapZoom (it's not needed for
  // display) — 10 matches the City schema's own default, so the map still
  // centers at a sensible zoom for a city picked this way.
  return { _id: result._id, name: result.name, latitude: result.latitude, longitude: result.longitude, defaultMapZoom: 10 };
}

function toSelectedCityFromResolved(city: ResolvedCity): SelectedCity {
  return { _id: city._id, name: city.name, latitude: city.latitude, longitude: city.longitude, defaultMapZoom: city.defaultMapZoom };
}

// Searches every city already in the DB plus any city in India via
// OpenStreetMap (mirrors apps/web's useCitySearch/city-selector-sheet) — an
// admin adding a pandal for a brand-new city no longer needs a separate trip
// to the Cities admin page first. Picking a "nominatim" result calls
// POST /cities/resolve to materialize the row before it's usable as cityId.
export function CityCombobox({ value, onSelect }: CityComboboxProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<CitySearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(next: string) {
    setQuery(next);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchCities(next);
      setResults(found);
      setLoading(false);
    }, DEBOUNCE_MS);
  }

  async function handleSelect(result: CitySearchResult) {
    if (result.source === "db") {
      onSelect(toSelectedCity(result));
      setQuery(result.name);
      setOpen(false);
      return;
    }
    setResolving(true);
    try {
      const city = await resolveCity(result);
      if (city) {
        onSelect(toSelectedCityFromResolved(city));
        setQuery(city.name);
        setOpen(false);
      }
    } finally {
      setResolving(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        required
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search any city in India…"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-2xl border border-border bg-panel p-1.5 shadow-2xl">
          {loading ? (
            <p className="px-3 py-3 font-body text-sm text-ink-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 font-body text-sm text-ink-muted">No matching places in India.</p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.name}-${index}`}
                type="button"
                onClick={() => handleSelect(result)}
                disabled={resolving}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left font-body text-sm hover:bg-card disabled:opacity-60"
              >
                <span>
                  {result.name} <span className="text-ink-muted">· {result.state}</span>
                </span>
                {result.source === "nominatim" && <Badge tone="accent">New city — will be created</Badge>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
