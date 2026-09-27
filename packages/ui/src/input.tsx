import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

// Standardized on the login page's style (the one place that already had a
// focus-visible ring) instead of the plainer `rounded-lg`/no-focus-style
// inputs used everywhere else — every other hand-rolled admin input was
// missing keyboard focus feedback entirely.
const BASE_CLASSES =
  "h-12 rounded-xl border border-border bg-card px-4 font-body text-ink outline-none focus:border-brand disabled:opacity-50";

export function Input({ className = "", ...props }: InputProps) {
  return <input className={`${BASE_CLASSES} ${className}`} {...props} />;
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return (
    <textarea
      className={`min-h-24 rounded-xl border border-border bg-card px-4 py-3 font-body text-ink outline-none focus:border-brand disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
