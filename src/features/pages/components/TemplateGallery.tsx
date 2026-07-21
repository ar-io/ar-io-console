import { useMemo } from 'react';
import { FilePlus2, Sparkles } from 'lucide-react';
import type { TemplateId } from '../schema';
import { listTemplates, renderPageHtml, type PagesTemplate, type RenderCtx, type TemplateFamily } from '../render/renderPageHtml';
import { renderCtxFor } from '../publish/renderCtx';
import { useElementWidth } from './useElementWidth';
import { useStore } from '@/store/useStore';

interface TemplateGalleryProps {
  arioGatewayUrl?: string;
  onSelectTemplate: (id: TemplateId) => void;
  onStartBlank: () => void;
}

const FAMILY_ORDER: TemplateFamily[] = ['modern', 'creator', 'pro', 'classic', 'developer', 'wildcard'];
const FAMILY_LABELS: Record<TemplateFamily, string> = {
  classic: 'Classic-era internet',
  modern: 'Modern web',
  creator: 'Creator',
  pro: 'Professional',
  developer: 'Developer',
  wildcard: 'Wildcards',
};

/** Design width the thumbnail iframe renders at before being scaled to fit. */
const THUMB_W = 400;
const THUMB_H = 300;

function ThumbPreview({ html }: { html: string }) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const scale = width > 0 ? width / THUMB_W : 0;
  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-white"
      style={{ height: scale ? THUMB_H * scale : 150 }}
    >
      {scale > 0 && (
        <iframe
          title="Template preview"
          srcDoc={html}
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            width: THUMB_W,
            height: THUMB_H,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  html,
  onSelect,
}: {
  template: PagesTemplate;
  html: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/20 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative border-b border-border/20">
        <ThumbPreview html={html} />
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-foreground/70 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-foreground shadow">
            Use this template
          </span>
        </div>
      </div>
      <div className="p-4">
        <h4 className="font-heading text-base font-bold text-foreground">{template.meta.name}</h4>
        <p className="mt-1 line-clamp-2 text-xs text-foreground/70">{template.meta.description}</p>
      </div>
    </button>
  );
}

export default function TemplateGallery({
  arioGatewayUrl,
  onSelectTemplate,
  onStartBlank,
}: TemplateGalleryProps) {
  const templates = useMemo(() => listTemplates(), []);
  const configMode = useStore((s) => s.configMode);

  // One shared render context for every thumbnail; seeds carry their own showcase
  // identity so no per-template ctx is needed.
  const ctx: RenderCtx = useMemo(
    () => renderCtxFor({} as never, { arioGatewayUrl, configMode }),
    [arioGatewayUrl, configMode],
  );

  const htmlById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of templates) {
      try {
        map[t.id] = renderPageHtml(t.seed, ctx);
      } catch (err) {
        console.error(`Failed to render thumbnail for template "${t.id}":`, err);
        map[t.id] = '<!doctype html><html><body></body></html>';
      }
    }
    return map;
  }, [templates, ctx]);

  const byFamily = useMemo(() => {
    const groups: Record<TemplateFamily, PagesTemplate[]> = {
      classic: [],
      modern: [],
      creator: [],
      pro: [],
      developer: [],
      wildcard: [],
    };
    for (const t of templates) groups[t.meta.family].push(t);
    return groups;
  }, [templates]);

  return (
    <div className="space-y-8">
      {/* Start options */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="font-heading text-base font-bold text-foreground">Pick a template</h4>
            <p className="text-xs text-foreground/70">
              Every template is a starting point — restyle, rewrite and reorder freely.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartBlank}
          className="flex items-center gap-4 rounded-2xl border border-border/20 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-card">
            <FilePlus2 className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <h4 className="font-heading text-base font-bold text-foreground">Start blank</h4>
            <p className="text-xs text-foreground/70">Begin from a clean, minimal page.</p>
          </div>
        </button>
      </div>

      {FAMILY_ORDER.map((family) => {
        const group = byFamily[family];
        if (group.length === 0) return null;
        return (
          <section key={family}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/60">
              {FAMILY_LABELS[family]}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  html={htmlById[t.id]}
                  onSelect={() => onSelectTemplate(t.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
