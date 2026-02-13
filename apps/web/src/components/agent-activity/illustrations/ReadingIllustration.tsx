/**
 * Reading illustration — document with text lines and a scanning line.
 * A horizontal scan line sweeps vertically across the document.
 */
export function ReadingIllustration() {
  const textLines = [
    { y: 48, width: 70 },
    { y: 58, width: 55 },
    { y: 68, width: 65 },
    { y: 78, width: 45 },
    { y: 88, width: 60 },
    { y: 98, width: 50 },
    { y: 108, width: 68 },
    { y: 118, width: 40 },
  ];

  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {/* Document body */}
      <rect
        x="45"
        y="15"
        width="110"
        height="130"
        rx="4"
        className="fill-card stroke-border"
        strokeWidth="1.5"
      />

      {/* Corner fold */}
      <path d="M 135 15 L 155 15 L 155 35 Z" className="fill-muted stroke-border" strokeWidth="1" />
      <path d="M 135 15 L 135 35 L 155 35" className="fill-card stroke-border" strokeWidth="1" />

      {/* Text lines */}
      {textLines.map((line, i) => (
        <rect
          key={i}
          x="58"
          y={line.y}
          width={line.width}
          height="3"
          rx="1.5"
          className="fill-muted-foreground/15"
        />
      ))}

      {/* Scanning line with glow */}
      <g className="animate-scan-line">
        <line
          x1="50"
          y1="35"
          x2="150"
          y2="35"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            filter: 'drop-shadow(0 0 4px var(--primary))',
          }}
        />
      </g>
    </svg>
  );
}
