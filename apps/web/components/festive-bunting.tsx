const FLAG_COLORS = ["#FF4433", "#FFB547", "#7A2E4D", "#FFB547", "#FF4433"];

export interface FestiveBuntingProps {
  className?: string;
  flagCount?: number;
}

// A hand-strung pennant garland (the kind actually hung across real pandal
// entrances) instead of a plain section divider — this is the single most
// "festival, not dating-app" signal on the page: real string sag, alternating
// warm colors, small tassels. Pure SVG, no image asset needed.
export function FestiveBunting({ className = "", flagCount = 11 }: FestiveBuntingProps) {
  const width = 100;
  const sag = 9;
  const flagHeight = 8;
  const flagWidth = 6.2;

  function pointOnString(t: number) {
    // Quadratic bezier: (0,0) -> control (width/2, sag*2) -> (width,0)
    const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * (width / 2) + t * t * width;
    const y = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * sag * 2 + t * t * 0;
    return { x, y };
  }

  const flags = Array.from({ length: flagCount }, (_, i) => {
    const t = (i + 1) / (flagCount + 1);
    const { x, y } = pointOnString(t);
    return { x, y, color: FLAG_COLORS[i % FLAG_COLORS.length] };
  });

  const stringPath = `M 0,0 Q ${width / 2},${sag * 2} ${width},0`;

  return (
    <svg viewBox={`0 -2 ${width} ${sag * 2 + flagHeight + 2}`} className={className} preserveAspectRatio="none">
      <path d={stringPath} fill="none" stroke="rgba(244,239,246,.25)" strokeWidth="0.5" />
      {flags.map((flag, i) => (
        <g key={i} transform={`translate(${flag.x}, ${flag.y})`}>
          <path
            d={`M ${-flagWidth / 2},0 L ${flagWidth / 2},0 L 0,${flagHeight} Z`}
            fill={flag.color}
          />
        </g>
      ))}
    </svg>
  );
}
