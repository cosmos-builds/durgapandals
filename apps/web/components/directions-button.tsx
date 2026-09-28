import { externalDirectionsUrl } from "@durgapandals/maps";
import type { PandalSummary } from "@/lib/api";

export interface DirectionsButtonProps {
  pandal: Pick<PandalSummary, "latitude" | "longitude">;
  /** "compact": small "Go" pill (list rows). "full": icon + "Directions" label,
   *  sized by its flex container. "block": same as full but forces full width. */
  variant?: "compact" | "full" | "block";
  className?: string;
}

// The same bg-brand/text-brand-ink anchor tag was hand-rolled at 4 call
// sites (saved-list, preview-sheet, pandal-detail x2) with near-identical
// markup — this is that shared version instead of a 5th copy-paste.
export function DirectionsButton({ pandal, variant = "full", className = "" }: DirectionsButtonProps) {
  const sizeClasses =
    variant === "compact"
      ? "h-11 flex-none gap-1.5 rounded-2xl px-3.5 text-sm"
      : variant === "block"
        ? "h-12 flex-1 gap-1.5 rounded-2xl font-body text-sm"
        : "h-11 gap-1.5 rounded-full px-4 text-sm";

  return (
    <a
      href={externalDirectionsUrl(pandal)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center bg-brand font-body font-bold text-brand-ink ${sizeClasses} ${className}`}
    >
      <span className="material-symbols-rounded text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
        directions
      </span>
      {variant === "compact" ? "Go" : "Directions"}
    </a>
  );
}
