import type { PageDef } from '../../schema';
import type { RenderCtx } from '../../render/renderPageHtml';

/** Shared props for the editor's left-column control sections. */
export interface ControlProps {
  def: PageDef;
  /** Apply a pure update to the working def (parent stamps `updatedAt`). */
  update: (updater: (d: PageDef) => PageDef) => void;
  /** Render/resolve context (gateway + ArNS host) for `ar://` URL previews. */
  ctx: RenderCtx;
}
