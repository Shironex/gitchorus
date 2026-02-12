import { describe, it, expect, beforeEach } from 'vitest';
import { themeOptions } from '@/lib/theme';

// We need to reset the store between tests since Zustand stores are singletons
const { useSettingsStore } = await import('./useSettingsStore');

describe('useSettingsStore - dark class toggling', () => {
  const root = document.documentElement;

  beforeEach(() => {
    // Clean up all classes on root
    root.className = '';
    // Reset store to default theme
    useSettingsStore.getState().setTheme('dark');
  });

  describe('applyTheme / setTheme', () => {
    it('should add "dark" class for the default dark theme', () => {
      useSettingsStore.getState().setTheme('dark');
      expect(root.classList.contains('dark')).toBe(true);
    });

    it('should add "dark" class for non-default dark themes (dracula)', () => {
      useSettingsStore.getState().setTheme('dracula');
      expect(root.classList.contains('dracula')).toBe(true);
      expect(root.classList.contains('dark')).toBe(true);
    });

    it('should add "dark" class for non-default dark themes (nord)', () => {
      useSettingsStore.getState().setTheme('nord');
      expect(root.classList.contains('nord')).toBe(true);
      expect(root.classList.contains('dark')).toBe(true);
    });

    it('should add "dark" class for non-default dark themes (tokyonight)', () => {
      useSettingsStore.getState().setTheme('tokyonight');
      expect(root.classList.contains('tokyonight')).toBe(true);
      expect(root.classList.contains('dark')).toBe(true);
    });

    it('should NOT add "dark" class for light themes', () => {
      useSettingsStore.getState().setTheme('light');
      expect(root.classList.contains('light')).toBe(true);
      expect(root.classList.contains('dark')).toBe(false);
    });

    it('should NOT add "dark" class for non-default light themes (github)', () => {
      useSettingsStore.getState().setTheme('github');
      expect(root.classList.contains('github')).toBe(true);
      expect(root.classList.contains('dark')).toBe(false);
    });

    it('should remove "dark" class when switching from dark to light theme', () => {
      useSettingsStore.getState().setTheme('dracula');
      expect(root.classList.contains('dark')).toBe(true);

      useSettingsStore.getState().setTheme('light');
      expect(root.classList.contains('dark')).toBe(false);
      expect(root.classList.contains('dracula')).toBe(false);
      expect(root.classList.contains('light')).toBe(true);
    });

    it('should add "dark" class when switching from light to dark theme', () => {
      useSettingsStore.getState().setTheme('light');
      expect(root.classList.contains('dark')).toBe(false);

      useSettingsStore.getState().setTheme('catppuccin');
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.classList.contains('catppuccin')).toBe(true);
      expect(root.classList.contains('light')).toBe(false);
    });

    it('should handle switching between dark themes correctly', () => {
      useSettingsStore.getState().setTheme('dracula');
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.classList.contains('dracula')).toBe(true);

      useSettingsStore.getState().setTheme('nord');
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.classList.contains('nord')).toBe(true);
      expect(root.classList.contains('dracula')).toBe(false);
    });

    it('should add "dark" class for ALL dark themes in themeOptions', () => {
      const darkThemes = themeOptions.filter(t => t.isDark);
      for (const theme of darkThemes) {
        useSettingsStore.getState().setTheme(theme.value);
        expect(root.classList.contains('dark')).toBe(true);
        expect(root.classList.contains(theme.value)).toBe(true);
      }
    });

    it('should NOT add "dark" class for ANY light theme in themeOptions', () => {
      const lightThemes = themeOptions.filter(t => !t.isDark);
      for (const theme of lightThemes) {
        useSettingsStore.getState().setTheme(theme.value);
        expect(root.classList.contains('dark')).toBe(false);
        expect(root.classList.contains(theme.value)).toBe(true);
      }
    });
  });

  describe('setPreviewTheme', () => {
    it('should add "dark" class when previewing a dark theme', () => {
      useSettingsStore.getState().setTheme('light');
      expect(root.classList.contains('dark')).toBe(false);

      useSettingsStore.getState().setPreviewTheme('dracula');
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.classList.contains('dracula')).toBe(true);
    });

    it('should remove "dark" class when previewing a light theme from a dark base', () => {
      useSettingsStore.getState().setTheme('dracula');
      expect(root.classList.contains('dark')).toBe(true);

      useSettingsStore.getState().setPreviewTheme('light');
      expect(root.classList.contains('dark')).toBe(false);
      expect(root.classList.contains('light')).toBe(true);
    });

    it('should restore "dark" class when preview ends and base theme is dark', () => {
      useSettingsStore.getState().setTheme('dracula');

      // Preview a light theme
      useSettingsStore.getState().setPreviewTheme('light');
      expect(root.classList.contains('dark')).toBe(false);

      // End preview — should restore dracula (dark)
      useSettingsStore.getState().setPreviewTheme(null);
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.classList.contains('dracula')).toBe(true);
    });

    it('should not have "dark" class when preview ends and base theme is light', () => {
      useSettingsStore.getState().setTheme('light');

      // Preview a dark theme
      useSettingsStore.getState().setPreviewTheme('nord');
      expect(root.classList.contains('dark')).toBe(true);

      // End preview — should restore light
      useSettingsStore.getState().setPreviewTheme(null);
      expect(root.classList.contains('dark')).toBe(false);
      expect(root.classList.contains('light')).toBe(true);
    });
  });

  describe('closeSettings', () => {
    it('should restore "dark" class when closing settings with preview active', () => {
      useSettingsStore.getState().setTheme('nord');

      // Preview a light theme
      useSettingsStore.getState().setPreviewTheme('light');
      expect(root.classList.contains('dark')).toBe(false);

      // Open then close settings
      useSettingsStore.getState().openSettings();
      useSettingsStore.getState().closeSettings();

      // Should restore nord (dark)
      expect(root.classList.contains('dark')).toBe(true);
      expect(root.classList.contains('nord')).toBe(true);
    });
  });
});
