import { useEffect, useState } from 'react';
import type { ButtonShape, HeaderAlign, LinkStyle, PageWidth, Theme } from '../../schema';
import type { ControlProps } from './types';
import { FieldLabel, SegmentedControl } from './primitives';
import { BUTTON_SHAPES, FONT_OPTIONS, matchPresetId, THEME_PRESETS } from '../themePresets';

export default function ThemeControls({ def, update }: ControlProps) {
  const theme = def.theme;
  const layout = def.layout;
  const activePreset = matchPresetId(theme);
  const activeFont = FONT_OPTIONS.find((f) => f.value === theme.font)?.id ?? '';

  const setTheme = (patch: Partial<Theme>) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  const setColors = (patch: Partial<Theme['colors']>) =>
    update((d) => ({ ...d, theme: { ...d.theme, colors: { ...d.theme.colors, ...patch } } }));

  return (
    <div className="space-y-5">
      {/* Presets */}
      <div>
        <FieldLabel>Preset</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {THEME_PRESETS.map((preset) => {
            const c = preset.theme.colors;
            const active = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setTheme({ ...preset.theme, colors: { ...preset.theme.colors } })}
                aria-pressed={active}
                className={`overflow-hidden rounded-lg border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? 'border-primary ring-1 ring-primary' : 'border-border/20 hover:border-primary/40'
                }`}
              >
                <div className="flex h-8 items-center gap-1 px-2" style={{ background: c.bg }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: c.accent }} />
                  <span className="h-2 w-8 rounded-full" style={{ background: c.text, opacity: 0.7 }} />
                </div>
                <span className="block px-2 py-1 text-[11px] font-medium text-foreground">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <ColorField label="Accent" value={theme.colors.accent} onChange={(v) => setColors({ accent: v })} />
        <ColorField label="Background" value={theme.colors.bg} onChange={(v) => setColors({ bg: v })} />
        <ColorField label="Surface" value={theme.colors.surface} onChange={(v) => setColors({ surface: v })} />
        <ColorField label="Text" value={theme.colors.text} onChange={(v) => setColors({ text: v })} />
      </div>

      {/* Font */}
      <div>
        <FieldLabel>Font</FieldLabel>
        <SegmentedControl
          value={activeFont}
          options={FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label }))}
          onChange={(id) => {
            const font = FONT_OPTIONS.find((f) => f.id === id);
            if (font) setTheme({ font: font.value });
          }}
        />
      </div>

      {/* Button shape */}
      <SegmentedControl<ButtonShape>
        label="Button shape"
        value={theme.buttonShape}
        options={BUTTON_SHAPES.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(v) => setTheme({ buttonShape: v })}
      />

      {/* Background style */}
      <SegmentedControl
        label="Background"
        value={theme.background === 'gradient' ? 'gradient' : 'solid'}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'gradient', label: 'Gradient' },
        ]}
        onChange={(v) => setTheme({ background: v })}
      />

      <div className="border-t border-border/20 pt-4">
        <FieldLabel>Layout</FieldLabel>
        <div className="space-y-3">
          <SegmentedControl<HeaderAlign>
            label="Header align"
            value={layout.headerAlign}
            options={[
              { value: 'center', label: 'Center' },
              { value: 'left', label: 'Left' },
            ]}
            onChange={(v) => update((d) => ({ ...d, layout: { ...d.layout, headerAlign: v } }))}
          />
          <SegmentedControl<LinkStyle>
            label="Link style"
            value={layout.linkStyle}
            options={[
              { value: 'button', label: 'Button' },
              { value: 'card', label: 'Card' },
              { value: 'grid', label: 'Grid' },
            ]}
            onChange={(v) => update((d) => ({ ...d, layout: { ...d.layout, linkStyle: v } }))}
          />
          <SegmentedControl<PageWidth>
            label="Width"
            value={layout.width}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'wide', label: 'Wide' },
            ]}
            onChange={(v) => update((d) => ({ ...d, layout: { ...d.layout, width: v } }))}
          />
        </div>
      </div>
    </div>
  );
}

const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  // Local draft so free-text typing isn't silently dropped when momentarily invalid.
  // Only a valid hex is committed to the theme; the last valid value is kept and the
  // field is marked invalid until it parses (#9).
  const [draft, setDraft] = useState(value);
  // Re-sync when the committed value changes from outside (presets, other edits).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const valid = isHexColor(draft);
  const safe = isHexColor(value) ? value : '#000000';
  const commit = (v: string) => {
    setDraft(v);
    if (isHexColor(v)) onChange(v);
  };

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 ${
          valid ? 'border-border/20' : 'border-error/60'
        }`}
      >
        <input
          type="color"
          value={safe}
          onChange={(e) => commit(e.target.value)}
          aria-label={`${label} color`}
          className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            // Discard an unparseable draft on blur so the field never lingers invalid.
            if (!isHexColor(draft)) setDraft(value);
          }}
          aria-invalid={!valid}
          aria-label={`${label} hex value`}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground focus:outline-none"
        />
      </div>
      {!valid && <p className="mt-1 text-[11px] text-error">Enter a 6-digit hex color, e.g. #5427C8.</p>}
    </div>
  );
}
