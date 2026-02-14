import { SlidersHorizontal, Check, Loader2, AlertTriangle, FlaskConical } from 'lucide-react';
import { clsx } from 'clsx';
import type { ReviewDepth, DefaultReviewAction, ReviewMode } from '@gitchorus/shared';
import { REVIEW_DEPTH_CONFIG } from '@gitchorus/shared';
import { useSettings } from '@/hooks/useSettings';

/** Ordered list of depth options */
const DEPTH_OPTIONS: ReviewDepth[] = ['quick', 'standard', 'thorough'];

/** Review mode options */
const REVIEW_MODE_OPTIONS: {
  value: ReviewMode;
  label: string;
  description: string;
  experimental?: boolean;
}[] = [
  {
    value: 'single-agent',
    label: 'Single Agent',
    description: 'One AI agent covers all review categories in a single pass',
  },
  {
    value: 'multi-agent',
    label: 'Multi-Agent',
    description: '4 specialized sub-agents review in parallel for deeper analysis',
    experimental: true,
  },
];

/** Review action labels */
const REVIEW_ACTION_OPTIONS: { value: DefaultReviewAction; label: string; description: string }[] =
  [
    {
      value: 'COMMENT',
      label: 'Comment',
      description: 'Leave feedback without explicit approval or rejection',
    },
    {
      value: 'REQUEST_CHANGES',
      label: 'Request Changes',
      description: 'Request changes before the PR can be merged',
    },
    { value: 'APPROVE', label: 'Approve', description: 'Approve the PR with review comments' },
  ];

export function ReviewPreferencesSection() {
  const { config, loading, updateConfig } = useSettings();

  if (loading && !config) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading settings...
        </div>
      </div>
    );
  }

  const validationDepth = config?.validationDepth ?? 'standard';
  const reviewDepth = config?.reviewDepth ?? 'standard';
  const reviewMode = config?.reviewMode ?? 'single-agent';
  const defaultReviewAction = config?.defaultReviewAction ?? 'COMMENT';
  const autoPush = config?.autoPush ?? false;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            'bg-linear-to-br from-primary/20 to-brand-600/10',
            'ring-1'
          )}
          style={
            {
              '--tw-ring-color': 'color-mix(in oklch, var(--primary), transparent 80%)',
            } as React.CSSProperties
          }
        >
          <SlidersHorizontal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Review Preferences</h2>
          <p className="text-sm text-muted-foreground">Configure how AI reviews are performed</p>
        </div>
      </div>

      {/* Validation Depth */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Validation Depth</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controls analysis depth for issue validation
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DEPTH_OPTIONS.map(depth => {
            const depthConfig = REVIEW_DEPTH_CONFIG[depth];
            const isSelected = validationDepth === depth;
            return (
              <button
                key={depth}
                onClick={() => updateConfig({ validationDepth: depth })}
                className={clsx(
                  'text-left rounded-xl border p-3 transition-all duration-200',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{depthConfig.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {depthConfig.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Review Depth */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Review Depth</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controls analysis depth for PR review
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {DEPTH_OPTIONS.map(depth => {
            const depthConfig = REVIEW_DEPTH_CONFIG[depth];
            const isSelected = reviewDepth === depth;
            return (
              <button
                key={depth}
                onClick={() => updateConfig({ reviewDepth: depth })}
                className={clsx(
                  'text-left rounded-xl border p-3 transition-all duration-200',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{depthConfig.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {depthConfig.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Review Mode */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Review Mode</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose between single agent or multi-agent review pipeline
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REVIEW_MODE_OPTIONS.map(option => {
            const isSelected = reviewMode === option.value;
            return (
              <button
                key={option.value}
                onClick={() => updateConfig({ reviewMode: option.value })}
                className={clsx(
                  'text-left rounded-xl border p-3 transition-all duration-200',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    {option.experimental && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                        <FlaskConical className="w-2.5 h-2.5" />
                        Experimental
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
        {reviewMode === 'multi-agent' && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
              <FlaskConical className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <span className="font-semibold">Experimental feature.</span> Multi-agent review is
                not fully tested and may produce inconsistent results. Use single-agent mode for
                reliable reviews.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border/50 p-3">
              <AlertTriangle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Multi-agent reviews use ~2-4x more tokens than single-agent reviews due to
                specialized sub-agent overhead.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Default Review Action */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">Default Review Action</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Default action when pushing review to GitHub
          </p>
        </div>
        <div className="space-y-2">
          {REVIEW_ACTION_OPTIONS.map(option => {
            const isSelected = defaultReviewAction === option.value;
            return (
              <button
                key={option.value}
                onClick={() => updateConfig({ defaultReviewAction: option.value })}
                className={clsx(
                  'w-full text-left rounded-xl border p-3 transition-all duration-200',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-Push Toggle */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Auto-Push</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Skip preview modal and push results directly to GitHub
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoPush}
            onClick={() => updateConfig({ autoPush: !autoPush })}
            className={clsx(
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
              autoPush ? 'bg-primary' : 'bg-muted'
            )}
          >
            <span
              className={clsx(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                autoPush ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
