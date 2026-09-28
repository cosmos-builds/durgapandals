export function PandalPhotoPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-panel ${className}`}>
      <span className="material-symbols-rounded text-2xl text-ink-muted/60">photo_camera</span>
    </div>
  );
}
