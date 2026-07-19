import { useState } from 'react';
import { Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import type { PageMeta } from '../../schema';
import type { ControlProps } from './types';
import { FieldLabel, TextAreaField, TextField } from './primitives';
import { useListKeys } from './useListKeys';
import type { Tag } from '../../publish/tags';

/**
 * Cap a favicon input to at most two grapheme clusters. Slicing by UTF-16 length
 * (the old `maxLength={4}`) splits flag/ZWJ emoji mid-sequence into broken glyphs;
 * grapheme segmentation keeps each emoji whole (#8).
 */
function capFaviconEmoji(input: string): string {
  const SegmenterCtor = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (typeof SegmenterCtor === 'function') {
    const graphemes = Array.from(
      new SegmenterCtor(undefined, { granularity: 'grapheme' }).segment(input),
      (seg) => seg.segment,
    );
    return graphemes.slice(0, 2).join('');
  }
  // Fallback: cap by code points (still keeps surrogate-pair emoji intact).
  return [...input].slice(0, 4).join('');
}

interface PageSettingsControlsProps extends ControlProps {
  customTags: Tag[];
  onCustomTagsChange: (tags: Tag[]) => void;
  labels: string[];
  onLabelsChange: (labels: string[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
}

export default function PageSettingsControls({
  def,
  update,
  customTags,
  onCustomTagsChange,
  labels,
  onLabelsChange,
  note,
  onNoteChange,
}: PageSettingsControlsProps) {
  const [labelDraft, setLabelDraft] = useState('');
  const meta = def.meta ?? {};
  const setMeta = (patch: Partial<PageMeta>) =>
    update((d) => ({ ...d, meta: { ...(d.meta ?? {}), ...patch } }));

  // Transient per-row keys so deleting a mid-list tag doesn't shift focus/values (#10).
  const { keys: tagKeys, append: appendTagKey, removeAt: removeTagKey } = useListKeys(customTags.length);
  const addTag = () => {
    appendTagKey();
    onCustomTagsChange([...customTags, { name: '', value: '' }]);
  };
  const removeTag = (index: number) => {
    removeTagKey(index);
    onCustomTagsChange(customTags.filter((_, j) => j !== index));
  };

  const addLabel = () => {
    const v = labelDraft.trim();
    if (!v || labels.includes(v)) {
      setLabelDraft('');
      return;
    }
    onLabelsChange([...labels, v]);
    setLabelDraft('');
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Page title"
        value={def.title}
        onChange={(v) => update((d) => ({ ...d, title: v }))}
        placeholder="My page"
        maxLength={120}
      />
      <TextField
        label="SEO title (optional)"
        value={meta.seoTitle ?? ''}
        onChange={(v) => setMeta({ seoTitle: v || undefined })}
        placeholder="Defaults to the page title"
        maxLength={120}
      />
      <TextAreaField
        label="SEO / social description"
        value={meta.description ?? ''}
        onChange={(v) => setMeta({ description: v || undefined })}
        placeholder="Shown when your link is shared"
        maxLength={300}
        rows={2}
      />
      <div className="w-28">
        <TextField
          label="Favicon emoji"
          value={meta.faviconEmoji ?? ''}
          onChange={(v) => {
            const capped = capFaviconEmoji(v);
            setMeta({ faviconEmoji: capped || undefined });
          }}
          placeholder="🔗"
        />
      </div>

      {/* Organizational labels (local only) */}
      <div className="border-t border-border/20 pt-4">
        <FieldLabel>Labels (private, for your dashboard)</FieldLabel>
        {labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
              >
                {label}
                <button
                  type="button"
                  onClick={() => onLabelsChange(labels.filter((l) => l !== label))}
                  aria-label={`Remove label ${label}`}
                  className="text-primary/70 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLabel();
              }
            }}
            placeholder="Add a label…"
            className="min-w-0 flex-1 rounded-lg border border-border/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={addLabel}
            className="inline-flex items-center gap-1 rounded-lg border border-border/20 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/50"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Custom Arweave tags */}
      <div className="border-t border-border/20 pt-4">
        <FieldLabel>Custom Arweave tags</FieldLabel>
        <p className="mb-2 flex items-center gap-1 text-xs text-foreground/50">
          <TagIcon className="h-3 w-3" /> Added to the on-chain data item for discoverability.
        </p>
        <div className="space-y-2">
          {customTags.map((tag, i) => (
            <div key={tagKeys[i] ?? i} className="flex items-center gap-2">
              <input
                type="text"
                value={tag.name}
                onChange={(e) =>
                  onCustomTagsChange(customTags.map((t, j) => (j === i ? { ...t, name: e.target.value } : t)))
                }
                placeholder="Name"
                aria-label="Tag name"
                className="min-w-0 flex-1 rounded-lg border border-border/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <input
                type="text"
                value={tag.value}
                onChange={(e) =>
                  onCustomTagsChange(customTags.map((t, j) => (j === i ? { ...t, value: e.target.value } : t)))
                }
                placeholder="Value"
                aria-label="Tag value"
                className="min-w-0 flex-1 rounded-lg border border-border/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => removeTag(i)}
                aria-label="Remove tag"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border/20 text-foreground/60 transition-colors hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTag}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
        >
          <Plus className="h-3.5 w-3.5" /> Add tag
        </button>
      </div>

      {/* Version note */}
      <div className="border-t border-border/20 pt-4">
        <TextField
          label="Version note (optional)"
          value={note}
          onChange={onNoteChange}
          placeholder="What changed in this version"
          maxLength={200}
        />
      </div>
    </div>
  );
}
