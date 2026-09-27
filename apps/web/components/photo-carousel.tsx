"use client";

import { useRef, useState } from "react";

export interface Photo {
  url: string;
  altText?: string;
}

export interface PhotoCarouselProps {
  photos: Photo[];
  fallbackImage?: string;
  alt: string;
  className?: string;
  /** "center" (default, used by the map preview sheet) or "start" (matches
   *  the pandal detail hero's bottom-left dot placement). */
  dotsAlign?: "center" | "start";
}

// pandal.year.photos was already being fetched from the API and never
// rendered anywhere — this was the only image shown being a single
// coverImage. Swipeable with scroll-snap (no JS drag library needed) plus
// dot indicators, matching a Google Maps place-page photo gallery.
export function PhotoCarousel({ photos, fallbackImage, alt, className = "", dotsAlign = "center" }: PhotoCarouselProps) {
  const images = photos.length > 0 ? photos : fallbackImage ? [{ url: fallbackImage }] : [];
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActive(index);
  }

  function scrollTo(index: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  if (images.length === 0) {
    return <div className={`h-full w-full bg-panel ${className}`} />;
  }

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((photo, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.url + index}
            src={photo.url}
            alt={photo.altText ?? alt}
            className="h-full w-full flex-none snap-center object-cover"
          />
        ))}
      </div>

      {images.length > 1 && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-3 flex gap-1.5 ${
            dotsAlign === "start" ? "justify-start pl-4" : "justify-center"
          }`}
        >
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              aria-label={`Photo ${index + 1}`}
              className={`pointer-events-auto h-1.5 rounded-pill transition-all ${
                index === active ? "w-4 bg-accent" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
