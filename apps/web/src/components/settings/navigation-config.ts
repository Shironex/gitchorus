import type { ComponentType } from 'react';
import { Palette, Info, Github, Bot, SlidersHorizontal } from 'lucide-react';
import type { SettingsSectionId } from '@gitchorus/shared';

export interface NavigationItem {
  id: SettingsSectionId;
  label: string;
  icon: ComponentType<{ className?: string; size?: string | number }>;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

/**
 * Navigation groups for the settings sidebar
 */
export const NAV_GROUPS: NavigationGroup[] = [
  {
    label: 'Analysis',
    items: [
      { id: 'provider', label: 'AI Provider', icon: Bot },
      { id: 'review-preferences', label: 'Review Preferences', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Integrations',
    items: [{ id: 'github', label: 'GitHub CLI', icon: Github }],
  },
  {
    label: 'Interface',
    items: [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'general', label: 'About', icon: Info },
    ],
  },
];

/**
 * Flat list of all nav items
 */
export const NAV_ITEMS: NavigationItem[] = NAV_GROUPS.flatMap(group => group.items);
