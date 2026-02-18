import { Bot, Check, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { DEFAULT_CODEX_MODEL_OPTIONS } from '@gitchorus/shared';
import { useSettings } from '@/hooks/useSettings';

export function ProviderSection() {
  const { config, loading, updateConfig, models } = useSettings();

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

  const selectedModel = config?.model ?? 'gpt-5.2';
  const baseModels = models.length > 0 ? models : DEFAULT_CODEX_MODEL_OPTIONS;
  const modelOptions = baseModels.some(model => model.id === selectedModel)
    ? baseModels
    : [{ id: selectedModel, label: selectedModel }, ...baseModels];

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
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Provider</h2>
          <p className="text-sm text-muted-foreground">Select which AI provider and model to use</p>
        </div>
      </div>

      {/* Provider Card */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Provider</h3>
        <div className="rounded-xl border border-primary/50 bg-primary/5 p-4 ring-1 ring-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-foreground">Codex</h3>
              <p className="text-xs text-muted-foreground">OpenAI Codex via Codex SDK</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" />
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Model</h3>
        <div className="space-y-2">
          {modelOptions.map(model => {
            const isSelected = selectedModel === model.id;
            return (
              <button
                key={model.id}
                onClick={() => updateConfig({ model: model.id })}
                className={clsx(
                  'w-full text-left rounded-xl border p-4 transition-all duration-200',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">{model.label}</span>
                    {model.description ? (
                      <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
                    ) : null}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
