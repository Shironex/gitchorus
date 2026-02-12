/**
 * Searching illustration — magnifying glass scanning over code lines.
 * The glass floats horizontally while a matching line highlights.
 */
export function SearchingIllustration() {
  const codeLines = [
    { y: 40, width: 80, x: 30 },
    { y: 52, width: 60, x: 42 },
    { y: 64, width: 90, x: 30 },
    { y: 76, width: 50, x: 42 },
    { y: 88, width: 75, x: 30 },
    { y: 100, width: 65, x: 42 },
    { y: 112, width: 85, x: 30 },
    { y: 124, width: 55, x: 42 },
  ];

  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {/* Code lines background */}
      {codeLines.map((line, i) => (
        <rect
          key={i}
          x={line.x}
          y={line.y}
          width={line.width}
          height="3"
          rx="1.5"
          className="fill-muted-foreground/15"
        />
      ))}

      {/* Highlighted "found" line — pulses */}
      <rect
        x="30" y="64" width="90" height="3" rx="1.5"
        className="fill-primary/40"
        style={{ animation: 'pulseSubtle 2s ease-in-out infinite' }}
      />

      {/* Magnifying glass — floats */}
      <g className="animate-float">
        {/* Glass circle */}
        <circle
          cx="130" cy="75" r="18"
          className="stroke-primary"
          fill="none"
          strokeWidth="2.5"
          style={{ filter: 'drop-shadow(0 0 3px var(--primary))' }}
        />
        {/* Glass fill — subtle tint */}
        <circle
          cx="130" cy="75" r="16"
          className="fill-primary/5"
        />
        {/* Handle */}
        <line
          x1="143" y1="88"
          x2="155" y2="100"
          className="stroke-primary"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Reflection gleam */}
        <path
          d="M 120 67 Q 124 62, 128 65"
          className="stroke-primary/30"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
