import { Loader2 } from 'lucide-react';
import { useSplashScreen } from '@/hooks/useSplashScreen';

/**
 * Full-screen branded splash overlay displayed during app initialization.
 *
 * Covers the entire viewport while the backend WebSocket connects.
 * Fades out with a subtle scale-up animation once the app is ready
 * (or after a 10s safety timeout).
 *
 * Uses CSS custom properties so it automatically matches the user's
 * selected theme (applied to <html> before React mounts).
 */
export function SplashScreen() {
  const { isVisible, isDismissing, showSpinner, statusText, version } = useSplashScreen();

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-[var(--background)]"
      style={{
        opacity: isDismissing ? 0 : 1,
        transform: isDismissing ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 500ms ease-out, transform 500ms ease-out',
      }}
    >
      {/* Logo */}
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="GitChorus"
        className="h-24 w-24"
        draggable={false}
      />

      {/* Version label */}
      {version && (
        <span className="mt-3 rounded-full bg-[var(--brand-500)]/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--brand-400)] ring-1 ring-[var(--brand-500)]/20 select-none">
          v{version}
        </span>
      )}

      {/* Spinner + status text container */}
      <div
        className="mt-8 flex flex-col items-center gap-3"
        style={{
          opacity: showSpinner ? 1 : 0,
          transition: 'opacity 300ms ease-in',
        }}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-400)]" />
        <p className="text-sm text-[var(--foreground-muted)] select-none">{statusText}</p>
      </div>
    </div>
  );
}
