import { useEffect, useRef, useState } from 'react';
import type { PageDef } from '../schema';
import type { RenderCtx } from '../render/renderPageHtml';
import { renderPageHtml } from '../render/renderPageHtml';

interface LivePreviewProps {
  def: PageDef;
  ctx: RenderCtx;
  /** How long to wait after the last edit before re-rendering (default 250ms). */
  debounceMs?: number;
  className?: string;
}

function safeRender(def: PageDef, ctx: RenderCtx): string {
  try {
    return renderPageHtml(def, ctx);
  } catch (err) {
    console.error('Pages live preview failed to render:', err);
    return (
      '<!doctype html><html><body style="margin:0;font-family:system-ui,sans-serif;' +
      'display:flex;align-items:center;justify-content:center;height:100vh;color:#dc2626;' +
      'text-align:center;padding:24px">Preview unavailable — check the page content.</body></html>'
    );
  }
}

/**
 * A phone-framed, non-interactive live preview of the page. The generated HTML is
 * recomputed on a debounce (default 250ms) so fast typing never tears the iframe
 * down mid-keystroke; the iframe element itself stays mounted and only its
 * `srcDoc` updates. The frame is fully sandboxed (no script execution / no
 * navigation) since it is a preview.
 */
export default function LivePreview({ def, ctx, debounceMs = 250, className }: LivePreviewProps) {
  const [html, setHtml] = useState<string>(() => safeRender(def, ctx));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHtml(safeRender(def, ctx)), debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [def, ctx, debounceMs]);

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[360px]">
        <div className="rounded-[2.25rem] border-[10px] border-foreground/85 bg-foreground/85 shadow-xl">
          <div className="relative overflow-hidden rounded-[1.4rem] bg-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 z-10 h-4 w-28 -translate-x-1/2 rounded-b-2xl bg-foreground/85"
            />
            <iframe
              title="Live page preview"
              srcDoc={html}
              sandbox=""
              loading="eager"
              className="block h-[620px] w-full border-0 bg-white"
            />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-foreground/60">
          Live preview · updates as you edit
        </p>
      </div>
    </div>
  );
}
