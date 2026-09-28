"use client";

import { useEffect } from "react";
import { rememberLastCity } from "@/lib/visitor";

// Invisible — just records "this is the last city the visitor actually
// looked at" so a later bare "/" visit can resume there instead of always
// landing on the algorithmic default city.
export function LastCityTracker({ citySlug }: { citySlug: string }) {
  useEffect(() => {
    rememberLastCity(citySlug);
  }, [citySlug]);

  return null;
}
