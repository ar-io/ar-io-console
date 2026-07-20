import { useState } from 'react';
import { Menu } from '@headlessui/react';
import {
  AlignLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Link2,
  Minus,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Block, BlockType, SocialBlock } from '../../schema';
import type { ControlProps } from './types';
import { TextAreaField, TextField } from './primitives';
import { useListKeys } from './useListKeys';
import { isArUrl, resolveArUrl } from '../../render/arResolve';
import type { RenderCtx } from '../../render/renderPageHtml';

function newId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID();
  return `blk-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

const BLOCK_MENU: { type: BlockType; label: string; icon: typeof Link2; hint: string }[] = [
  { type: 'link', label: 'Link', icon: Link2, hint: 'A full-width button link' },
  { type: 'social', label: 'Social row', icon: Share2, hint: 'A row of platform links' },
  { type: 'heading', label: 'Heading', icon: Heading, hint: 'A section label' },
  { type: 'text', label: 'Text', icon: AlignLeft, hint: 'A short paragraph' },
  { type: 'image', label: 'Image', icon: ImageIcon, hint: 'An inline image' },
  { type: 'embed', label: 'Embed', icon: Sparkles, hint: 'Permaweb content (ar://)' },
  { type: 'divider', label: 'Divider', icon: Minus, hint: 'A visual separator' },
  { type: 'verify', label: 'Verify badge', icon: BadgeCheck, hint: 'Permanent-on-Arweave link' },
];

function metaFor(type: BlockType) {
  return BLOCK_MENU.find((m) => m.type === type) ?? BLOCK_MENU[0];
}

function newBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'link':
      return { type, id, label: 'New link', url: 'https://' };
    case 'social':
      return { type, id, items: [{ platform: 'x', url: 'https://x.com/' }] };
    case 'heading':
      return { type, id, text: 'Section' };
    case 'text':
      return { type, id, text: '' };
    case 'image':
      return { type, id, src: '', alt: '' };
    case 'embed':
      return { type, id, arweave: 'ar://' };
    case 'divider':
      return { type, id };
    case 'verify':
      return { type, id, label: 'Permanent on Arweave', url: '' };
  }
}

function blockTitle(block: Block): string {
  switch (block.type) {
    case 'link':
      return block.label || 'Link';
    case 'social':
      return `Social · ${block.items.length} link${block.items.length === 1 ? '' : 's'}`;
    case 'heading':
      return block.text || 'Heading';
    case 'text':
      return block.text ? block.text.slice(0, 32) : 'Text';
    case 'image':
      return block.alt || 'Image';
    case 'embed':
      return block.arweave || 'Embed';
    case 'divider':
      return 'Divider';
    case 'verify':
      return block.label || 'Verify badge';
  }
}

/** A URL input that shows a tiny resolved-URL preview for `ar://` / ArNS targets. */
function UrlField({
  label,
  value,
  onChange,
  placeholder,
  ctx,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ctx: RenderCtx;
}) {
  const trimmed = value.trim();
  const bareArns = /^[a-z0-9][a-z0-9-]*(_[a-z0-9-]+)?(\.[a-z0-9.-]+)?$/i.test(trimmed) &&
    !/^https?:|^mailto:|^#|^\//i.test(trimmed) &&
    !trimmed.startsWith('data:');
  const arForm = isArUrl(trimmed) ? trimmed : bareArns ? `ar://${trimmed}` : '';
  const resolved = arForm ? resolveArUrl(arForm, ctx) : '';
  return (
    <div>
      <TextField label={label} value={value} onChange={onChange} placeholder={placeholder ?? 'https:// · ar:// · myname.ar.io'} />
      {resolved && resolved !== trimmed && (
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-foreground/50">
          <ArrowRight className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{resolved}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Social-row editor. Split into its own component (not inlined in BlockBody's
 * switch) so its `useListKeys` hook always runs — and so deleting a mid-row social
 * link moves keys with the rows instead of by index, preventing focus/value shifts (#10).
 */
function SocialBlockFields({
  block,
  onChange,
  ctx,
}: {
  block: SocialBlock;
  onChange: (next: Block) => void;
  ctx: RenderCtx;
}) {
  const items = block.items;
  const { keys, append, removeAt } = useListKeys(items.length);
  const setItems = (next: SocialBlock['items']) => onChange({ ...block, items: next });
  const addItem = () => {
    append();
    setItems([...items, { platform: '', url: '' }]);
  };
  const removeItem = (i: number) => {
    removeAt(i);
    setItems(items.filter((_, j) => j !== i));
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={keys[i] ?? i} className="flex items-end gap-2">
          <div className="w-24 flex-shrink-0">
            <TextField label={i === 0 ? 'Platform' : undefined} value={item.platform} onChange={(v) => setItems(items.map((it, j) => (j === i ? { ...it, platform: v } : it)))} placeholder="x" />
          </div>
          <div className="min-w-0 flex-1">
            <UrlField label={i === 0 ? 'URL' : ''} value={item.url} onChange={(v) => setItems(items.map((it, j) => (j === i ? { ...it, url: v } : it)))} ctx={ctx} />
          </div>
          <button
            type="button"
            onClick={() => removeItem(i)}
            aria-label={`Remove ${item.platform || 'social'} link`}
            className="mb-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border/20 text-foreground/60 transition-colors hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
      >
        <Plus className="h-3.5 w-3.5" /> Add social link
      </button>
    </div>
  );
}

function BlockBody({
  block,
  onChange,
  ctx,
}: {
  block: Block;
  onChange: (next: Block) => void;
  ctx: RenderCtx;
}) {
  switch (block.type) {
    case 'link':
      return (
        <div className="space-y-3">
          <TextField label="Label" value={block.label} onChange={(v) => onChange({ ...block, label: v })} placeholder="My website" />
          <UrlField label="URL" value={block.url} onChange={(v) => onChange({ ...block, url: v })} ctx={ctx} />
          <TextField label="Icon (optional)" value={block.icon ?? ''} onChange={(v) => onChange({ ...block, icon: v || undefined })} placeholder="globe, star, square…" />
        </div>
      );
    case 'social':
      return <SocialBlockFields block={block} onChange={onChange} ctx={ctx} />;
    case 'heading':
      return <TextField label="Heading text" value={block.text} onChange={(v) => onChange({ ...block, text: v })} placeholder="Projects" />;
    case 'text':
      return <TextAreaField label="Text" value={block.text} onChange={(v) => onChange({ ...block, text: v })} placeholder="A short paragraph…" rows={3} />;
    case 'image':
      return (
        <div className="space-y-3">
          <UrlField label="Image source" value={block.src} onChange={(v) => onChange({ ...block, src: v })} placeholder="data: · ar://<txId> · https://" ctx={ctx} />
          <TextField label="Alt text" value={block.alt ?? ''} onChange={(v) => onChange({ ...block, alt: v || undefined })} placeholder="Describe the image" />
          <UrlField label="Link (optional)" value={block.link ?? ''} onChange={(v) => onChange({ ...block, link: v || undefined })} ctx={ctx} />
        </div>
      );
    case 'embed':
      return (
        <UrlField
          label="Permaweb target"
          value={block.arweave}
          onChange={(v) => onChange({ ...block, arweave: v })}
          placeholder="ar://<txId> or ar://myname"
          ctx={ctx}
        />
      );
    case 'divider':
      return <p className="text-xs text-foreground/50">A simple visual separator — no options.</p>;
    case 'verify':
      return (
        <div className="space-y-3">
          <TextField label="Label" value={block.label} onChange={(v) => onChange({ ...block, label: v })} placeholder="Permanent on Arweave" />
          <UrlField label="Verify URL (optional)" value={block.url} onChange={(v) => onChange({ ...block, url: v })} placeholder="Auto-links to your domain when published" ctx={ctx} />
          <p className="text-xs text-foreground/50">Left blank, this links to your page&rsquo;s domain (or is hidden if you have none).</p>
        </div>
      );
  }
}

export default function BlocksControls({ def, update, ctx }: ControlProps) {
  const blocks = def.blocks;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    update((d) => {
      const next = d.blocks.slice();
      const [b] = next.splice(from, 1);
      next.splice(to, 0, b);
      return { ...d, blocks: next };
    });
  };

  const add = (type: BlockType) => {
    const block = newBlock(type);
    update((d) => ({ ...d, blocks: [...d.blocks, block] }));
    setExpandedId(block.id ?? null);
  };

  const remove = (id: string) => {
    update((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    setExpandedId((cur) => (cur === id ? null : cur));
  };

  const replace = (id: string, next: Block) =>
    update((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? next : b)) }));

  return (
    <div className="space-y-3">
      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed border-border/40 bg-background px-3 py-4 text-center text-xs text-foreground/50">
          No blocks yet. Add your first link below.
        </p>
      )}

      <ul className="space-y-2">
        {blocks.map((block, index) => {
          const meta = metaFor(block.type);
          const Icon = meta.icon;
          const id = block.id ?? String(index);
          const expanded = expandedId === id;
          return (
            <li
              key={id}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault();
              }}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={`rounded-xl border bg-background transition-colors ${
                dragIndex === index ? 'border-primary/60 opacity-60' : 'border-border/20'
              }`}
            >
              <div className="flex items-center gap-1.5 px-2 py-2">
                <span
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragEnd={() => setDragIndex(null)}
                  aria-hidden="true"
                  title="Drag to reorder"
                  className="flex h-7 w-5 cursor-grab items-center justify-center text-foreground/30 hover:text-foreground/60 active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : id)}
                  aria-expanded={expanded}
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {blockTitle(block)}
                </button>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${meta.label} up`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === blocks.length - 1}
                    aria-label={`Move ${meta.label} down`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    aria-label={`Delete ${meta.label}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-error/10 hover:text-error focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="border-t border-border/20 p-3">
                  <BlockBody block={block} onChange={(next) => replace(id, next)} ctx={ctx} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Add-block menu */}
      <Menu as="div" className="relative">
        <Menu.Button className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Plus className="h-4 w-4" /> Add block
        </Menu.Button>
        <Menu.Items
          anchor="bottom start"
          className="z-30 max-h-72 w-[var(--button-width)] overflow-auto rounded-xl border border-border/20 bg-card p-1 shadow-lg focus:outline-none [--anchor-gap:6px]"
        >
          {BLOCK_MENU.map((m) => {
            const Icon = m.icon;
            return (
              <Menu.Item key={m.type}>
                {({ active }) => (
                  <button
                    type="button"
                    onClick={() => add(m.type)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      active ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{m.label}</span>
                      <span className="block truncate text-xs text-foreground/60">{m.hint}</span>
                    </span>
                  </button>
                )}
              </Menu.Item>
            );
          })}
        </Menu.Items>
      </Menu>
    </div>
  );
}
