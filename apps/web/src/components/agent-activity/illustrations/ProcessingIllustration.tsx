/**
 * Processing illustration — interlocking gears rotating.
 * Three gears arranged in a triangular pattern, rotating CW/CCW.
 */
export function ProcessingIllustration() {
  // Simple gear tooth path generator
  function gearPath(cx: number, cy: number, r: number, teeth: number): string {
    const innerR = r * 0.7;
    const outerR = r;
    const toothWidth = (Math.PI * 2) / (teeth * 2);
    const parts: string[] = [];

    for (let i = 0; i < teeth * 2; i++) {
      const angle = i * toothWidth - Math.PI / 2;
      const radius = i % 2 === 0 ? outerR : innerR;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    parts.push('Z');
    return parts.join(' ');
  }

  const gears = [
    { cx: 85, cy: 65, r: 28, teeth: 10, direction: 'cw' as const },
    { cx: 130, cy: 85, r: 22, teeth: 8, direction: 'ccw' as const },
    { cx: 80, cy: 115, r: 18, teeth: 7, direction: 'ccw' as const },
  ];

  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {gears.map((gear, i) => (
        <g
          key={i}
          style={{
            transformOrigin: `${gear.cx}px ${gear.cy}px`,
            animation: `${gear.direction === 'cw' ? 'gearCW' : 'gearCCW'} ${3 + i * 0.5}s linear infinite`,
          }}
        >
          {/* Gear body */}
          <path
            d={gearPath(gear.cx, gear.cy, gear.r, gear.teeth)}
            className={i === 0 ? 'fill-primary/20 stroke-primary' : 'fill-muted-foreground/10 stroke-muted-foreground/30'}
            strokeWidth="1.5"
          />
          {/* Center hole */}
          <circle
            cx={gear.cx}
            cy={gear.cy}
            r={gear.r * 0.25}
            className="fill-background stroke-border"
            strokeWidth="1"
          />
        </g>
      ))}
    </svg>
  );
}
