import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { renderPageHtml, type RenderCtx } from '../features/pages/render/renderPageHtml';
import { renderCtxFor } from '../features/pages/publish/renderCtx';
import { templates } from '../features/pages/templates';
import type { TemplateId } from '../features/pages/schema';
import { useElementWidth } from '../features/pages/components/useElementWidth';

// A real, self-contained Pages template rendered exactly as it resolves at an
// ArNS name — the same `renderPageHtml` + `<iframe srcDoc>` path PageCard uses
// for its thumbnails, not a hand-drawn mockup. Swap the id to feature a
// different template in the hero.
const SHOWCASE_TEMPLATE: TemplateId = 'aurora-glass';
const DESIGN_W = 440; // width the page renders at before being scaled to fit
const VIEWPORT_H = 340; // visible viewport height inside the browser frame

/**
 * Renders the showcase Pages template into the homepage's browser-frame mockup,
 * scaled to the frame's width and clipped to a viewport height (so it reads as
 * "the top of a real resolved page"). Lazy-loaded by LandingPage so the template
 * registry lands in its own chunk instead of the initial bundle.
 */
export default function ArNSResolvedPreview() {
  const configMode = useStore((s) => s.configMode);
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const scale = width > 0 ? width / DESIGN_W : 0;

  const html = useMemo(() => {
    try {
      const def = templates[SHOWCASE_TEMPLATE].seed;
      const ctx: RenderCtx = renderCtxFor(def, { configMode }, { arnsName: 'maya' });
      return renderPageHtml(def, ctx);
    } catch (e) {
      console.error('ArNS hero preview render failed:', e);
      return '<!doctype html><html><body></body></html>';
    }
  }, [configMode]);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-white"
      style={{ height: VIEWPORT_H }}
    >
      {scale > 0 && (
        <iframe
          title="Example resolved page"
          srcDoc={html}
          sandbox=""
          scrolling="no"
          tabIndex={-1}
          aria-hidden="true"
          style={{
            width: DESIGN_W,
            // Render tall enough to fill the viewport after scaling; overflow clips.
            height: Math.ceil(VIEWPORT_H / (scale || 1)) + 400,
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
