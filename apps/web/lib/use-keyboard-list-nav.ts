"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

// Arrow-key + Enter navigation for a flat list of search results — shared
// by the intro hero and the city selector sheet's search dropdowns, neither
// of which supported anything but mouse/touch selection before this.
export function useKeyboardListNav<T>(items: T[], onSelect: (item: T) => void) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // A fresh set of results (new search, or the list clearing) shouldn't
  // keep a stale index highlighted against unrelated rows.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [items]);

  function onKeyDown(event: KeyboardEvent) {
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < items.length) {
      event.preventDefault();
      onSelect(items[highlightedIndex] as T);
    } else if (event.key === "Escape") {
      setHighlightedIndex(-1);
    }
  }

  return { highlightedIndex, onKeyDown };
}
