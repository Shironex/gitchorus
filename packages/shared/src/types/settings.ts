/**
 * Settings Types - Shared types for settings storage
 */

/**
 * Theme - All available color themes
 * 21 dark themes + 20 light themes = 41 total
 */
export type Theme =
  // Dark themes (21)
  | 'dark'
  | 'ayu-dark'
  | 'ayu-mirage'
  | 'catppuccin'
  | 'dracula'
  | 'ember'
  | 'forest'
  | 'gray'
  | 'gruvbox'
  | 'matcha'
  | 'midnight'
  | 'monokai'
  | 'nord'
  | 'ocean'
  | 'onedark'
  | 'red'
  | 'retro'
  | 'solarized'
  | 'sunset'
  | 'synthwave'
  | 'tokyonight'
  // Light themes (20)
  | 'light'
  | 'ayu-light'
  | 'blossom'
  | 'bluloco'
  | 'cream'
  | 'feather'
  | 'github'
  | 'gruvboxlight'
  | 'lavender'
  | 'mint'
  | 'nordlight'
  | 'onelight'
  | 'paper'
  | 'peach'
  | 'rose'
  | 'sand'
  | 'sepia'
  | 'sky'
  | 'snow'
  | 'solarizedlight';

/**
 * Settings section IDs for navigation
 */
export type SettingsSectionId =
  | 'appearance'
  | 'github'
  | 'general'
  | 'provider'
  | 'review-preferences';

/** Review depth levels -- maps to maxTurns and prompt detail */
export type ReviewDepth = 'quick' | 'standard' | 'thorough';

/** Default review action for GitHub push */
export type DefaultReviewAction = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/** Built-in Codex model identifiers used as defaults/fallbacks */
export type KnownCodexModel = 'gpt-5-mini' | 'gpt-5' | 'gpt-5.2';

/** Codex model ID (runtime-discovered values are also allowed) */
export type CodexModel = string;

/** Model option surfaced to the UI */
export interface CodexModelOption {
  id: string;
  label: string;
  description?: string;
  isDefault?: boolean;
}

/** Display labels for Codex models */
export const CODEX_MODEL_LABELS: Record<KnownCodexModel, string> = {
  'gpt-5-mini': 'GPT-5 Mini',
  'gpt-5': 'GPT-5',
  'gpt-5.2': 'GPT-5.2',
};

/** Default model options used as fallback when dynamic model discovery is unavailable */
export const DEFAULT_CODEX_MODEL_OPTIONS: CodexModelOption[] = [
  {
    id: 'gpt-5-mini',
    label: CODEX_MODEL_LABELS['gpt-5-mini'],
    description: 'Fastest and lowest-cost option for quick scans',
  },
  {
    id: 'gpt-5',
    label: CODEX_MODEL_LABELS['gpt-5'],
    description: 'Balanced speed and quality for everyday reviews',
  },
  {
    id: 'gpt-5.2',
    label: CODEX_MODEL_LABELS['gpt-5.2'],
    description: 'Most capable analysis for difficult changes',
    isDefault: true,
  },
];

/**
 * Map of deprecated model IDs to their current replacements.
 * Used to migrate stored settings from older versions.
 */
export const DEPRECATED_MODEL_MAP: Record<string, string> = {
  'claude-haiku-3-5-20241022': 'gpt-5-mini',
  'claude-haiku-4-5-20251001': 'gpt-5-mini',
  'claude-sonnet-4-20250514': 'gpt-5',
  'claude-sonnet-4-5': 'gpt-5',
  'claude-sonnet-4-5-20250929': 'gpt-5',
  'claude-opus-4-6-20250528': 'gpt-5.2',
  'claude-opus-4-6': 'gpt-5.2',
};

/**
 * Turn multipliers per model to account for capability differences.
 * Smaller models (Haiku) tend to use more tool calls per task.
 */
export const MODEL_TURN_MULTIPLIERS: Record<string, number> = {
  'gpt-5-mini': 1.5,
  'gpt-5': 1.0,
  'gpt-5.2': 1.0,
};

/** Review depth display labels and descriptions */
export const REVIEW_DEPTH_CONFIG: Record<
  ReviewDepth,
  { label: string; description: string; validationMaxTurns: number; reviewMaxTurns: number }
> = {
  quick: {
    label: 'Quick',
    description: 'Fast scan, surface-level issues only',
    validationMaxTurns: 40,
    reviewMaxTurns: 60,
  },
  standard: {
    label: 'Standard',
    description: 'Balanced analysis with good coverage',
    validationMaxTurns: 50,
    reviewMaxTurns: 80,
  },
  thorough: {
    label: 'Thorough',
    description: 'Deep dive with exhaustive analysis',
    validationMaxTurns: 100,
    reviewMaxTurns: 150,
  },
};

/** Global review configuration persisted in electron-store */
export interface ReviewConfig {
  /** Selected Codex model */
  model: CodexModel;
  /** Review depth for issue validation */
  validationDepth: ReviewDepth;
  /** Review depth for PR review */
  reviewDepth: ReviewDepth;
  /** Default review action when pushing to GitHub */
  defaultReviewAction: DefaultReviewAction;
  /** Skip preview modal and push directly */
  autoPush: boolean;
}

/** Default review config */
export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  model: 'gpt-5.2',
  validationDepth: 'standard',
  reviewDepth: 'standard',
  defaultReviewAction: 'COMMENT',
  autoPush: false,
};

/**
 * Dark themes list
 */
export const DARK_THEMES: Theme[] = [
  'dark',
  'ayu-dark',
  'ayu-mirage',
  'catppuccin',
  'dracula',
  'ember',
  'forest',
  'gray',
  'gruvbox',
  'matcha',
  'midnight',
  'monokai',
  'nord',
  'ocean',
  'onedark',
  'red',
  'retro',
  'solarized',
  'sunset',
  'synthwave',
  'tokyonight',
];

/**
 * Light themes list
 */
export const LIGHT_THEMES: Theme[] = [
  'light',
  'ayu-light',
  'blossom',
  'bluloco',
  'cream',
  'feather',
  'github',
  'gruvboxlight',
  'lavender',
  'mint',
  'nordlight',
  'onelight',
  'paper',
  'peach',
  'rose',
  'sand',
  'sepia',
  'sky',
  'snow',
  'solarizedlight',
];

/**
 * All themes list
 */
export const ALL_THEMES: Theme[] = [...DARK_THEMES, ...LIGHT_THEMES];

/**
 * Check if a theme is dark
 */
export function isDarkTheme(theme: Theme): boolean {
  return DARK_THEMES.includes(theme);
}
