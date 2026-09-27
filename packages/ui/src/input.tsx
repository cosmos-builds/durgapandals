import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

// The single input style for the whole site (web + admin) — a light field
// against the app's dark surfaces reads as an actual fillable box instead
// of blending into the card/panel behind it (a dark-on-dark bordered input
// was getting reported as "looks like a label, not an input"). Every raw
// hand-styled input across both apps should route through this instead of
// redefining its own colors.
const BASE_CLASSES =
  "h-14 rounded-2xl bg-ink px-5 font-body text-ground outline-none placeholder:text-ink-muted/70 focus:ring-2 focus:ring-brand disabled:opacity-50";

export function Input({ className = "", ...props }: InputProps) {
  return <input className={`${BASE_CLASSES} ${className}`} {...props} />;
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`min-h-24 rounded-2xl bg-ink px-5 py-4 font-body text-ground outline-none placeholder:text-ink-muted/70 focus:ring-2 focus:ring-brand disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
