/**
 * Theme presets + font choices for the Pages editor (PRD §7.5).
 *
 * A theme is a visual skin, independent of the chosen template — any preset works
 * on any template. All font stacks are system-safe (no external fonts) so the
 * published page loads instantly and stays permaweb/CSP-safe (PRD §7.6).
 */

import type { ButtonShape, Theme } from '../schema';

export interface ThemePreset {
  id: string;
  name: string;
  theme: Theme;
}

/** System-safe font stacks the published HTML can embed literally. */
export const FONT_OPTIONS: { id: string; label: string; value: string }[] = [
  {
    id: 'sans',
    label: 'Sans',
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'serif',
    label: 'Serif',
    value: 'Georgia, "Times New Roman", "Liberation Serif", serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    value: 'ui-monospace, "SF Mono", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    value: '"Nunito", "Quicksand", "Segoe UI", system-ui, sans-serif',
  },
];

export const BUTTON_SHAPES: { id: ButtonShape; label: string }[] = [
  { id: 'pill', label: 'Pill' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' },
];

const SANS = FONT_OPTIONS[0].value;
const MONO = FONT_OPTIONS[2].value;

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'brand',
    name: 'ar.io Brand',
    theme: {
      colors: { bg: '#FFFFFF', surface: '#F0F0F0', text: '#23232D', accent: '#5427C8' },
      font: SANS,
      buttonShape: 'pill',
      background: 'solid',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    theme: {
      colors: { bg: '#0B0B12', surface: '#16161F', text: '#F5F5F7', accent: '#8B7CF6' },
      font: SANS,
      buttonShape: 'pill',
      background: 'solid',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    theme: {
      colors: { bg: '#FFFFFF', surface: '#F6F6F7', text: '#111111', accent: '#111111' },
      font: SANS,
      buttonShape: 'rounded',
      background: 'solid',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    theme: {
      colors: { bg: '#F5F1E8', surface: '#EDE7D8', text: '#2B2620', accent: '#B4472E' },
      font: FONT_OPTIONS[1].value,
      buttonShape: 'rounded',
      background: 'solid',
    },
  },
  {
    id: 'terminal',
    name: 'Terminal',
    theme: {
      colors: { bg: '#0A0F0A', surface: '#0F160F', text: '#B8FFB8', accent: '#35FF6B' },
      font: MONO,
      buttonShape: 'square',
      background: 'solid',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora',
    theme: {
      colors: { bg: '#10131F', surface: '#1A2033', text: '#EAF0FF', accent: '#6EA8FE' },
      font: SANS,
      buttonShape: 'pill',
      background: 'gradient',
    },
  },
];

/** The preset whose colors most closely match a theme (for swatch highlighting). */
export function matchPresetId(theme: Theme): string | null {
  const found = THEME_PRESETS.find(
    (p) =>
      p.theme.colors.bg.toLowerCase() === theme.colors.bg.toLowerCase() &&
      p.theme.colors.accent.toLowerCase() === theme.colors.accent.toLowerCase() &&
      p.theme.colors.text.toLowerCase() === theme.colors.text.toLowerCase(),
  );
  return found ? found.id : null;
}
