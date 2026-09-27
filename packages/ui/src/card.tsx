import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const PADDING_CLASSES: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-5",
  md: "p-6",
  lg: "p-8",
};

// The one "rounded-card border border-border bg-panel" wrapper that every
// admin page hand-rolled separately (10+ near-identical occurrences) —
// extracted so the surface style only lives in one place.
export function Card({ padding = "md", className = "", ...props }: CardProps) {
  return <div className={`rounded-card border border-border bg-panel ${PADDING_CLASSES[padding]} ${className}`} {...props} />;
}
