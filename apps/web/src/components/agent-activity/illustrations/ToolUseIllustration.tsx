/**
 * Tool use illustration — terminal window with blinking cursor.
 * Simplified terminal with traffic lights and a prompt.
 */
export function ToolUseIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="w-48 h-40" aria-hidden="true">
      {/* Terminal window frame */}
      <rect
        x="30"
        y="20"
        width="140"
        height="120"
        rx="6"
        className="fill-card stroke-border"
        strokeWidth="1.5"
      />

      {/* Title bar */}
      <rect x="30" y="20" width="140" height="24" rx="6" className="fill-muted" />
      {/* Bottom corners of title bar are square */}
      <rect x="30" y="38" width="140" height="6" className="fill-muted" />

      {/* Traffic light dots */}
      <circle cx="46" cy="32" r="4" className="fill-destructive/60" />
      <circle cx="58" cy="32" r="4" className="fill-status-warning/60" />
      <circle cx="70" cy="32" r="4" className="fill-status-success/60" />

      {/* Terminal body (darker area) */}
      <rect x="31" y="44" width="138" height="95" rx="0" className="fill-background" />
      <rect x="31" y="133" width="138" height="6" rx="0 0 6 6" className="fill-background" />

      {/* Prompt lines */}
      {/* Line 1: completed command */}
      <text x="40" y="62" className="fill-status-success text-[9px] font-mono">
        $
      </text>
      <rect x="52" y="56" width="60" height="3" rx="1.5" className="fill-muted-foreground/20" />

      {/* Line 2: output */}
      <rect x="44" y="70" width="80" height="3" rx="1.5" className="fill-muted-foreground/10" />

      {/* Line 3: completed command */}
      <text x="40" y="90" className="fill-status-success text-[9px] font-mono">
        $
      </text>
      <rect x="52" y="84" width="45" height="3" rx="1.5" className="fill-muted-foreground/20" />

      {/* Line 4: output */}
      <rect x="44" y="98" width="70" height="3" rx="1.5" className="fill-muted-foreground/10" />

      {/* Active line: prompt with cursor */}
      <text x="40" y="118" className="fill-status-success text-[9px] font-mono">
        $
      </text>
      <rect x="52" y="112" width="30" height="3" rx="1.5" className="fill-primary/40" />

      {/* Blinking cursor */}
      <rect
        x="85"
        y="110"
        width="2"
        height="10"
        rx="1"
        className="fill-primary"
        style={{ animation: 'cursorBlink 0.8s step-end infinite' }}
      />
    </svg>
  );
}
