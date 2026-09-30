"use client";

import { useEffect, useRef, useState } from "react";
import { searchLocations, type LocationSearchResult } from "@/lib/api";

export interface LocationSearchBoxProps {
  citySlug: string;
  placeholder?: string;
  onSelect: (result: LocationSearchResult) => void;
  className?: string;
  // Biases results near wherever the user is actually looking (e.g. the
  // live pin in the Add Pandal flow) instead of always the city's fixed
  // centre — without this, "near me" could resolve to a same-named place
  // clear across the state (spec: search should return relevant results).
  // Ranking only, never excludes a distant result — see `restrictNear`.
  biasCenter?: { latitude: number; longitude: number };
  // Hard-restricts results to near this point instead of just ranking —
  // used once a city has been explicitly chosen (Add Pandal's city step),
  // where a distant same-named result genuinely isn't relevant anymore.
  restrictNear?: { latitude: number; longitude: number };
}

const DEBOUNCE_MS = 350;

// Shared between the Map home search bar and the Add Pandal location step
// (spec §8.1's "search" extends to place lookup, not just pandal names) —
// debounced so geocoding isn't called on every keystroke (spec §5.4).
export function LocationSearchBox({ citySlug, placeholder, onSelect, className = "", biasCenter, restrictNear }: LocationSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const found = await searchLocations(citySlug, value, biasCenter, restrictNear);
      setResults(found);
      setSearched(true);
      setLoading(false);
    }, DEBOUNCE_MS);
  }

  function handleSelect(result: LocationSearchResult) {
    onSelect(result);
    setQuery(result.label);
    setOpen(false);
    setResults([]);
    setSearched(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Matches the app's dark surfaces (bg-panel, same as the results
          list below) instead of the bright cream pill this used to be — a
          border plus shadow keeps it legible floating over the map without
          standing out as a jarring light element against an otherwise
          all-dark UI. */}
      <div className="flex h-10 md:h-11 items-center gap-2 rounded-2xl border border-border bg-panel px-3 md:px-3.5 shadow-[0_8px_28px_rgba(0,0,0,.45)]">
        <span className="material-symbols-rounded flex-none text-[18px] text-ink-muted">search</span>
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search a location…"}
          className="flex-1 bg-transparent font-body text-[13.5px] md:text-[14.5px] text-ink outline-none placeholder:text-ink-muted"
        />
        {loading && <span className="material-symbols-rounded flex-none animate-spin text-base text-ink-muted">progress_activity</span>}
      </div>

      {open && (results.length > 0 || (searched && !loading)) && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-20 flex max-h-[260px] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-border bg-panel p-1.5 shadow-2xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 font-body text-sm text-ink-muted">
              No results nearby for "{query}" — try a broader area name.
            </p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.latitude}-${result.longitude}-${index}`}
                onClick={() => handleSelect(result)}
                className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-card"
              >
                <span className="material-symbols-rounded mt-0.5 text-lg text-brand">location_on</span>
                <span className="line-clamp-2 font-body text-sm">{result.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
