// A flat gray box with a faint icon reads as "broken image" rather than "no
// photo yet" — a subtle festive gradient + a temple glyph makes it look like
// an intentional placeholder instead of a missing asset.
export function PandalPhotoPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-panel ${className}`}
      style={{
        backgroundImage:
          "radial-gradient(120% 120% at 30% 20%, rgba(255,181,71,.16), transparent 60%), radial-gradient(120% 120% at 80% 90%, rgba(255,68,51,.12), transparent 60%)",
      }}
    >
      <span className="material-symbols-rounded text-3xl text-ink-muted/50">temple_hindu</span>
    </div>
  );
}
