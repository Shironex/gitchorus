type ParticleStyle = React.CSSProperties & {
  '--tx': string;
  '--ty': string;
};

/**
 * Complete illustration — checkmark inside a circle with particle burst.
 * Checkmark draws in, particles radiate outward (plays once).
 */
export function CompleteIllustration() {
  const particles = [
    { x: 20, y: -25, color: 'fill-primary/60' },
    { x: -22, y: -18, color: 'fill-status-success/60' },
    { x: 28, y: 5, color: 'fill-primary/40' },
    { x: -25, y: 10, color: 'fill-status-warning/50' },
    { x: 15, y: 25, color: 'fill-status-success/40' },
    { x: -15, y: 22, color: 'fill-primary/50' },
    { x: 30, y: -12, color: 'fill-status-success/50' },
    { x: -30, y: -5, color: 'fill-primary/30' },
  ];

  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {/* Outer ring */}
      <circle
        cx="100"
        cy="80"
        r="38"
        className="stroke-primary/20"
        fill="none"
        strokeWidth="1.5"
        style={{
          opacity: 0,
          animation: 'fadeIn 0.3s ease-out forwards',
        }}
      />

      {/* Main circle */}
      <circle
        cx="100"
        cy="80"
        r="30"
        className="fill-primary/10 stroke-primary"
        strokeWidth="2"
        style={{
          opacity: 0,
          transform: 'scale(0.8)',
          transformOrigin: '100px 80px',
          animation: 'fadeIn 0.3s ease-out forwards',
        }}
      />

      {/* Checkmark */}
      <polyline
        points="85,82 95,92 115,70"
        className="stroke-primary"
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="40"
        strokeDashoffset="40"
        style={{
          animation: 'drawCheck 0.5s ease-out 0.3s forwards',
        }}
      />

      {/* Particles */}
      {particles.map((p, i) => (
        <circle
          key={i}
          cx="100"
          cy="80"
          r={2 + (i % 2)}
          className={p.color}
          style={
            {
              '--tx': `${p.x}px`,
              '--ty': `${p.y}px`,
              opacity: 0,
              animation: `particleBurst 0.5s ease-out ${0.4 + i * 0.05}s forwards`,
            } as ParticleStyle
          }
        />
      ))}
    </svg>
  );
}
