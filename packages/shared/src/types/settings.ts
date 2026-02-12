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
export type SettingsSectionId = 'appearance' | 'github' | 'general' | 'provider' | 'review-preferences';

/** Review depth levels -- maps to maxTurns and prompt detail */
export type ReviewDepth = 'quick' | 'standard' | 'thorough';

/** Default review action for GitHub push */
export type DefaultReviewAction = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/** Claude model options */
export type ClaudeModel = 'claude-haiku-3-5-20241022' | 'claude-sonnet-4-5-20250929' | 'claude-opus-4-6-20250528';

/** Display labels for Claude models */
export const CLAUDE_MODEL_LABELS: Record<ClaudeModel, string> = {
  'claude-haiku-3-5-20241022': 'Haiku',
  'claude-sonnet-4-5-20250929': 'Sonnet',
  'claude-opus-4-6-20250528': 'Opus',
};

/** Review depth display labels and descriptions */
export const REVIEW_DEPTH_CONFIG: Record<ReviewDepth, { label: string; description: string; validationMaxTurns: number; reviewMaxTurns: number }> = {
  quick: { label: 'Quick', description: 'Fast scan, surface-level issues only', validationMaxTurns: 15, reviewMaxTurns: 25 },
  standard: { label: 'Standard', description: 'Balanced analysis with good coverage', validationMaxTurns: 30, reviewMaxTurns: 50 },
  thorough: { label: 'Thorough', description: 'Deep dive with exhaustive analysis', validationMaxTurns: 50, reviewMaxTurns: 80 },
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
