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
};
