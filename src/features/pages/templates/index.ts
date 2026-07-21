/**
 * Pages template registry.
 *
 * Each template is a self-describing render module. This registry aggregates the
 * implemented modules keyed by TemplateId. Adding a template means importing its
 * module and adding one entry to MODULES — no changes to the renderer, schema, or
 * parser are required (PRD §7.4 extensibility).
 */

import type { TemplateId } from '../schema';
import type { PagesTemplate } from '../render/renderPageHtml';

// Classic-era internet
import { dialUpHomesteadTemplate } from './dial-up-homestead';
import { midnightTowerBbsTemplate } from './midnight-tower-bbs';
import { chromeDreamsTemplate } from './chrome-dreams';
import { topEightTemplate } from './top-eight';
// Modern web
import { bentoDeckTemplate } from './bento-deck';
import { auroraGlassTemplate } from './aurora-glass';
import { rawConcreteTemplate } from './raw-concrete';
import { theMastheadTemplate } from './the-masthead';
import { gridSystemTemplate } from './grid-system';
// Developer
import { shellSessionTemplate } from './shell-session';
import { readmeMdTemplate } from './readme-md';
import { manPageTemplate } from './man-page';
// Wildcards
import { sideATemplate } from './side-a';
import { xeroxRiotTemplate } from './xerox-riot';
import { tMinusTemplate } from './t-minus';
import { theArcanaTemplate } from './the-arcana';
// v3.1 expansion — modern
import { sunsetGradientTemplate } from './sunset-gradient';
import { meshNoirTemplate } from './mesh-noir';
import { spotlightTemplate } from './spotlight';
import { pastelPopTemplate } from './pastel-pop';
import { neoBrutalistTemplate } from './neo-brutalist';
// v3.1 expansion — creator
import { linkClassicTemplate } from './link-classic';
import { creatorHubTemplate } from './creator-hub';
import { musicDropTemplate } from './music-drop';
import { reelTemplate } from './reel';
// v3.1 expansion — pro
import { businessCardTemplate } from './business-card';
import { resumeTemplate } from './resume';
import { portfolioGridTemplate } from './portfolio-grid';
// v3.1 expansion — classic (wave 2)
import { desktop95Template } from './desktop-95';
import { teletextTemplate } from './teletext';
// v3.1 expansion — wildcard (wave 2)
import { boardingPassTemplate } from './boarding-pass';
import { tradingCardTemplate } from './trading-card';

/** Every implemented template module, in gallery (family) order. */
const MODULES: PagesTemplate[] = [
  dialUpHomesteadTemplate,
  midnightTowerBbsTemplate,
  chromeDreamsTemplate,
  topEightTemplate,
  bentoDeckTemplate,
  auroraGlassTemplate,
  rawConcreteTemplate,
  theMastheadTemplate,
  gridSystemTemplate,
  shellSessionTemplate,
  readmeMdTemplate,
  manPageTemplate,
  sideATemplate,
  xeroxRiotTemplate,
  tMinusTemplate,
  theArcanaTemplate,
  // v3.1 expansion — modern
  sunsetGradientTemplate,
  meshNoirTemplate,
  spotlightTemplate,
  pastelPopTemplate,
  neoBrutalistTemplate,
  // v3.1 expansion — creator
  linkClassicTemplate,
  creatorHubTemplate,
  musicDropTemplate,
  reelTemplate,
  // v3.1 expansion — pro
  businessCardTemplate,
  resumeTemplate,
  portfolioGridTemplate,
  // v3.1 expansion — classic (wave 2)
  desktop95Template,
  teletextTemplate,
  // v3.1 expansion — wildcard (wave 2)
  boardingPassTemplate,
  tradingCardTemplate,
];

/** Templates indexed by id (all 16 launch templates implemented). */
export const templates: Record<TemplateId, PagesTemplate> = Object.fromEntries(
  MODULES.map((t) => [t.id, t]),
) as Record<TemplateId, PagesTemplate>;

export {
  dialUpHomesteadTemplate,
  midnightTowerBbsTemplate,
  chromeDreamsTemplate,
  topEightTemplate,
  bentoDeckTemplate,
  auroraGlassTemplate,
  rawConcreteTemplate,
  theMastheadTemplate,
  gridSystemTemplate,
  shellSessionTemplate,
  readmeMdTemplate,
  manPageTemplate,
  sideATemplate,
  xeroxRiotTemplate,
  tMinusTemplate,
  theArcanaTemplate,
  sunsetGradientTemplate,
  meshNoirTemplate,
  spotlightTemplate,
  pastelPopTemplate,
  neoBrutalistTemplate,
  linkClassicTemplate,
  creatorHubTemplate,
  musicDropTemplate,
  reelTemplate,
  businessCardTemplate,
  resumeTemplate,
  portfolioGridTemplate,
  desktop95Template,
  teletextTemplate,
  boardingPassTemplate,
  tradingCardTemplate,
};
