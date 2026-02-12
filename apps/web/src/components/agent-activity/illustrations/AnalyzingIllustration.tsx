/**
 * Analyzing illustration — neural network nodes with pulsing connections.
 * Central node pulses, outer nodes light up with staggered animation.
 */
export function AnalyzingIllustration() {
  const nodes = [
    { cx: 100, cy: 80, r: 8, primary: true },   // center
    { cx: 55, cy: 45, r: 4.5 },                  // top-left
    { cx: 145, cy: 45, r: 4.5 },                 // top-right
    { cx: 40, cy: 90, r: 4 },                    // mid-left
    { cx: 160, cy: 90, r: 4 },                   // mid-right
    { cx: 60, cy: 130, r: 4 },                   // bottom-left
    { cx: 140, cy: 130, r: 4 },                  // bottom-right
    { cx: 100, cy: 40, r: 3.5 },                 // top
    { cx: 100, cy: 125, r: 3.5 },                // bottom
  ];

  const connections = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [0, 5], [0, 6], [0, 7], [0, 8],
    [1, 7], [2, 7], [3, 5], [4, 6],
  ];

  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {/* Connection lines */}
      {connections.map(([a, b], i) => (
        <line
          key={`conn-${i}`}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          className="stroke-muted-foreground/10"
          strokeWidth="1"
        />
      ))}

      {/* Pulse dots traveling along connections */}
      {connections.slice(0, 6).map(([a, b], i) => {
        const from = nodes[a];
        const to = nodes[b];
        return (
          <circle
            key={`pulse-${i}`}
            r="2"
            className="fill-primary/60"
          >
            <animateMotion
              dur={`${1.5 + i * 0.2}s`}
              repeatCount="indefinite"
              begin={`${i * 0.3}s`}
              path={`M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`}
            />
          </circle>
        );
      })}

      {/* Outer nodes */}
      {nodes.slice(1).map((node, i) => (
        <circle
          key={`node-${i}`}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          className="fill-muted-foreground/30"
          style={{
            animation: `pulseSubtle 2s ease-in-out ${i * 0.25}s infinite`,
            transformOrigin: `${node.cx}px ${node.cy}px`,
          }}
        />
      ))}

      {/* Central node — primary color, pulsing */}
      <circle
        cx={nodes[0].cx}
        cy={nodes[0].cy}
        r={nodes[0].r}
        className="fill-primary"
        style={{
          animation: 'pulseNode 2s ease-in-out infinite',
          transformOrigin: `${nodes[0].cx}px ${nodes[0].cy}px`,
          filter: 'drop-shadow(0 0 6px var(--primary))',
        }}
      />

      {/* Inner ring glow */}
      <circle
        cx={nodes[0].cx}
        cy={nodes[0].cy}
        r="14"
        className="stroke-primary/20"
        fill="none"
        strokeWidth="1"
        style={{
          animation: 'pulseNode 2s ease-in-out 0.5s infinite',
          transformOrigin: `${nodes[0].cx}px ${nodes[0].cy}px`,
        }}
      />
    </svg>
  );
}
