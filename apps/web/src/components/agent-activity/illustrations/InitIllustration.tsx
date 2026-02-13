/**
 * Init illustration — connecting dots forming a network.
 * Dots fade in with stagger, lines draw in via stroke-dasharray.
 */
export function InitIllustration() {
  const nodes = [
    { cx: 100, cy: 80, r: 6, delay: 0 },
    { cx: 60, cy: 50, r: 4, delay: 0.15 },
    { cx: 140, cy: 50, r: 4, delay: 0.3 },
    { cx: 50, cy: 100, r: 3.5, delay: 0.45 },
    { cx: 150, cy: 100, r: 3.5, delay: 0.6 },
    { cx: 80, cy: 130, r: 3, delay: 0.75 },
    { cx: 120, cy: 130, r: 3, delay: 0.9 },
  ];

  const connections = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
    [0, 5],
    [0, 6],
  ];

  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {/* Connection lines */}
      {connections.map(([a, b], i) => {
        const from = nodes[a];
        const to = nodes[b];
        const dx = to.cx - from.cx;
        const dy = to.cy - from.cy;
        const length = Math.sqrt(dx * dx + dy * dy);

        return (
          <line
            key={`line-${i}`}
            x1={from.cx}
            y1={from.cy}
            x2={to.cx}
            y2={to.cy}
            className="stroke-muted-foreground/20"
            strokeWidth="1"
            strokeDasharray={length}
            strokeDashoffset={length}
            style={{
              animation: `drawLine 1s ease-out ${i * 0.1}s forwards`,
            }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <circle
          key={`node-${i}`}
          cx={node.cx}
          cy={node.cy}
          r={node.r}
          className={i === 0 ? 'fill-primary' : 'fill-muted-foreground/40'}
          style={{
            opacity: 0,
            animation: `fadeIn 0.4s ease-out ${node.delay}s forwards${i === 0 ? ', pulseNode 2s ease-in-out 1s infinite' : ''}`,
            transformOrigin: `${node.cx}px ${node.cy}px`,
          }}
        />
      ))}
    </svg>
  );
}
