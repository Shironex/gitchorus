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

/** Claude model options */
export type ClaudeModel =
  | 'claude-haiku-4-5-20251001'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-opus-4-6';

/** Display labels for Claude models */
export const CLAUDE_MODEL_LABELS: Record<ClaudeModel, string> = {
  'claude-haiku-4-5-20251001': 'Haiku',
  'claude-sonnet-4-5-20250929': 'Sonnet',
  'claude-opus-4-6': 'Opus',
};

/**
 * Map of deprecated model IDs to their current replacements.
 * Used to migrate stored settings from older versions.
 */
export const DEPRECATED_MODEL_MAP: Record<string, ClaudeModel> = {
  'claude-haiku-3-5-20241022': 'claude-haiku-4-5-20251001',
  'claude-opus-4-6-20250528': 'claude-opus-4-6',
};

/**
 * Turn multipliers per model to account for capability differences.
 * Smaller models (Haiku) tend to use more tool calls per task.
 */
export const MODEL_TURN_MULTIPLIERS: Record<ClaudeModel, number> = {
  'claude-haiku-4-5-20251001': 1.5,
  'claude-sonnet-4-5-20250929': 1.0,
  'claude-opus-4-6': 1.0,
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
  /** Selected Claude model */
  model: ClaudeModel;
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
  model: 'claude-sonnet-4-5-20250929',
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
