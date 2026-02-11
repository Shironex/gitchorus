import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Theme, SettingsSectionId, GhCliStatus } from '@gitchorus/shared';
import { createLogger } from '@gitchorus/shared';
import { themeOptions } from '@/lib/theme';
import { persistTheme, getPersistedTheme } from '@/lib/theme-persistence';

const logger = createLogger('Settings');

/**
 * Settings modal state
 */
interface SettingsModalState {
  /** Whether the settings modal is open */
  isOpen: boolean;
  /** Active section in settings */
  activeSection: SettingsSectionId;
}

/**
 * Settings state
 */
interface SettingsState extends SettingsModalState {
  /** Current theme */
  theme: Theme;
  /** GitHub CLI status */
  githubCliStatus: GhCliStatus | null;
  /** Whether GitHub CLI status is loading */
  isGithubCliLoading: boolean;
  /** Preview theme (for hover preview) */
  previewTheme: Theme | null;
}

/**
 * Settings actions
 */
interface SettingsActions {
  /** Open settings modal */
  openSettings: (section?: SettingsSectionId) => void;
  /** Close settings modal */
  closeSettings: () => void;
  /** Navigate to a section */
  navigateToSection: (section: SettingsSectionId) => void;
  /** Set theme */
  setTheme: (theme: Theme) => void;
  /** Set preview theme (for hover) */
  setPreviewTheme: (theme: Theme | null) => void;
  /** Apply theme to DOM */
  applyTheme: (theme: Theme) => void;
  /** Set GitHub CLI status */
  setGithubCliStatus: (status: GhCliStatus | null) => void;
  /** Set GitHub CLI loading state */
  setGithubCliLoading: (loading: boolean) => void;
}

/**
 * Combined store type
 */
type SettingsStore = SettingsState & SettingsActions;

/**
 * Apply theme class to document element
 */
function applyThemeToDOM(theme: Theme) {
  logger.debug('applyThemeToDOM:', theme);
  const root = document.documentElement;
  const allThemeClasses = themeOptions.map(t => t.value);

  // Remove all theme classes
  root.classList.remove(...allThemeClasses);

  // Add new theme class
  root.classList.add(theme);
}

// Default theme
const DEFAULT_THEME: Theme = 'dark';

/**
 * Settings store using Zustand
 */
export const useSettingsStore = create<SettingsStore>()(
  devtools(
    (set, get) => {
      // Resolve initial theme from localStorage (instant) or fall back to default
      const initialTheme = (
        typeof document !== 'undefined' ? getPersistedTheme() : DEFAULT_THEME
      ) as Theme;

      // Apply initial theme on store initialization
      if (typeof document !== 'undefined') {
        applyThemeToDOM(initialTheme);
      }

      return {
        // Initial state
        isOpen: false,
        activeSection: 'appearance',
        theme: initialTheme,
        githubCliStatus: null,
        isGithubCliLoading: false,
        previewTheme: null,

        // Actions
        openSettings: (section?: SettingsSectionId) => {
          set(
            {
              isOpen: true,
              activeSection: section ?? get().activeSection,
            },
            undefined,
            'settings/openSettings'
          );
        },

        closeSettings: () => {
          const state = get();
          // Clear preview theme when closing
          if (state.previewTheme) {
            applyThemeToDOM(state.theme);
          }
          set(
            {
              isOpen: false,
              previewTheme: null,
            },
            undefined,
            'settings/closeSettings'
          );
        },

        navigateToSection: (section: SettingsSectionId) => {
          set({ activeSection: section }, undefined, 'settings/navigateToSection');
        },

        setTheme: (theme: Theme) => {
          set({ theme, previewTheme: null }, undefined, 'settings/setTheme');
          applyThemeToDOM(theme);
          persistTheme(theme);
        },

        setPreviewTheme: (theme: Theme | null) => {
          const state = get();
          set({ previewTheme: theme }, undefined, 'settings/setPreviewTheme');

          if (theme) {
            applyThemeToDOM(theme);
          } else {
            // Restore actual theme when preview ends
            applyThemeToDOM(state.theme);
          }
        },

        applyTheme: (theme: Theme) => {
          applyThemeToDOM(theme);
        },

        setGithubCliStatus: (status: GhCliStatus | null) => {
          set(
            { githubCliStatus: status, isGithubCliLoading: false },
            undefined,
            'settings/setGithubCliStatus'
          );
        },

        setGithubCliLoading: (loading: boolean) => {
          set({ isGithubCliLoading: loading }, undefined, 'settings/setGithubCliLoading');
        },
      };
    },
    { name: 'settings' }
  )
);

// Selectors

export const selectIsSettingsOpen = (state: SettingsStore) => state.isOpen;
export const selectActiveSection = (state: SettingsStore) => state.activeSection;
export const selectTheme = (state: SettingsStore) => state.theme;
export const selectPreviewTheme = (state: SettingsStore) => state.previewTheme;
export const selectEffectiveTheme = (state: SettingsStore) => state.previewTheme ?? state.theme;
export const selectGithubCliStatus = (state: SettingsStore) => state.githubCliStatus;
export const selectGithubCliLoading = (state: SettingsStore) => state.isGithubCliLoading;
