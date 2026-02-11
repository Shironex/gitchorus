import { Settings, Minus, Square, X as XIcon } from 'lucide-react';
import { APP_NAME } from '@gitchorus/shared';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { IS_MAC } from '@/lib/platform';

const isElectron = !!window.electronAPI;

export function TopBar() {
  const openSettings = useSettingsStore(state => state.openSettings);

  return (
    <div
      className={cn(
        'h-10 flex items-center justify-between',
        'border-b border-border bg-background/95 backdrop-blur-sm',
        'select-none drag',
        'shrink-0'
      )}
    >
      {/* Left: App name (offset on macOS for traffic lights) */}
      <div className={cn('flex items-center', IS_MAC ? 'pl-20' : 'pl-4')}>
        <span className="text-sm font-semibold text-foreground/80">{APP_NAME}</span>
      </div>

      {/* Right: Settings + Window controls */}
      <div className="flex items-center gap-1 pr-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openSettings()}
          className="no-drag w-7 h-7"
          aria-label="Settings"
        >
          <Settings size={15} />
        </Button>

        {/* Window controls (Electron only, hidden on macOS which uses native traffic lights) */}
        {isElectron && !IS_MAC && (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.electronAPI?.window.minimize()}
              className="no-drag w-7 h-7"
              aria-label="Minimize"
            >
              <Minus size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.electronAPI?.window.maximize()}
              className="no-drag w-7 h-7"
              aria-label="Maximize"
            >
              <Square size={12} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.electronAPI?.window.close()}
              className="no-drag w-7 h-7 hover:bg-destructive/20 hover:text-destructive"
              aria-label="Close"
            >
              <XIcon size={14} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
