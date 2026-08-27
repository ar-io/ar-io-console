# PRD — Pages (permaweb link-in-bio page creator)

**Status:** Draft for review
**Author:** Product (drafted with Claude Code)
**Date:** 2026-07-18
**Owning surface:** ar.io Console (`ar-io-console`)
**Related features:** Upload, Deploy Site, Domains (ArNS), Verify

---

## 1. TL;DR

A new console feature that lets anyone build a **Linktree-style page** — avatar, bio, and a stack of links — and publish it **permanently to Arweave in seconds**, then point their **ArNS name** at it. It reuses the existing single-file upload pipeline: the page is generated in-app as one self-contained HTML data item and uploaded exactly like any other file (credits / JIT / x402), so a small page is **free** under the bundler free tier.

Unlike Deploy Site (which needs a folder + build tooling), Pages is a **zero-file, in-console editor** with live preview. It is the fastest possible on-ramp to "I have a permanent thing on the permaweb at my own name."

**Recommended name:** **Pages** (see §4).

---

## 2. Problem & opportunity

**Problem.** The console today can upload a file, deploy a pre-built site folder, capture a URL, buy credits, and manage ArNS names. But there is no way for a non-technical user to *create* content. To get a personal page live at their ArNS name, a user must build HTML/a static site elsewhere, then use Deploy Site. That's a wall for the exact audience ArNS is meant to serve (creators, communities, individuals claiming a permanent identity).

**Opportunity.** Link-in-bio is the single most common "I need a page" use case on the internet, and it maps perfectly onto ar.io's primitives:

- A link-in-bio page is tiny → it lands **inside the free upload tier** → the console gets a genuinely free, permanent, no-account product to lead with.
- It gives every ArNS name an immediate, valuable default destination ("what do I point my name at?" now has a one-click answer).
- It is *permanent and verifiable* — a differentiator no centralized link-in-bio product (Linktree, Beacons, Bio.link) can match. The page can carry a "verified permanent" badge tied to the existing Verify feature.
- Every published page is tagged `App-Feature: Pages`, `Deployed-By: ar.io Console` — organic, on-chain distribution.

**Strategic fit.** Pages turns the console from a *tool for people who already have content* into a *place where content is born*. It deepens ArNS demand (pages need a name) and credit demand (richer pages with media exceed the free tier).

---

## 3. Goals & non-goals

### Goals
1. Create and publish a link-in-bio page in **under 60 seconds**, with no files and no code.
2. **Fit the existing single-file upload flow** — one HTML data item through `useFileUpload`, same payment paths (credits / JIT / x402), same free-tier logic.
3. **Versions like Deploy Site** — every publish is a new immutable TX; re-publishing re-points the same page; history is retained.
4. **ArNS assignment like Deploy Site** — point a name (base `@` or undername) at the page, reusing the exact Deploy patterns and Solana gating.
5. **List all pages** the user has created, with status, version, and domain, in a dedicated dashboard.
6. **Tags** — apply standardized Arweave tags for discoverability *and* let users add custom tags/labels.
7. **Editable & portable** — a user can come back and edit a published page, even on a new device, because the page is self-describing.

### Non-goals (for v1)
- Full drag-and-drop website builder / multi-page sites (that's Deploy Site's domain).
- Server-side analytics / click tracking (permaweb pages are static; see §8.9 for a light approach).
- Custom (DNS) domains beyond ArNS.
- Collaboration / multi-editor.
- Marketplace of third-party templates.
- Gated/paywalled links, email capture, e-commerce.

---

## 4. Naming

**Recommendation: `Pages`.** Route `/pages`. Nav label "Pages".

Rationale: the console's features are simple nouns/verbs — Upload, Deploy, Capture, Verify, Browse, Domains. "Pages" slots in natively, is instantly understood, and is **extensible** — the link-in-bio layout is just the first *template*; "Pages" can later hold profile cards, landing pages, event pages, etc., without a rename.

Within Pages, the first **layout family** is link-in-bio (subtitle in UI: *"Your permaweb profile"*), shipping as a small gallery of editable templates — **Creator, Project/DAO, Profile, Portfolio, Blank** (see §7.4). Every template is a starting point, not a cage: users can restructure, restyle, and rewrite freely.

Shortlist considered:

| Name | Read | Verdict |
|---|---|---|
| **Pages** | Neutral, extensible, native to console naming | ✅ Recommended |
| Profile / Profiles | Accurate for link-in-bio but boxes the feature in | Good alt if we want it narrowly scoped |
| Bio | Trendy, on-genre, but narrow and slangy | Alt |
| Links / LinkHub | Describes v1 well, dates quickly as feature grows | ✗ |
| Permapage | Distinctive/on-brand but cute; harder to say | ✗ |

Marketing tagline: *"Permanent link-in-bio pages — live at your name in seconds."*

---

## 5. Target users & use cases

**Personas**
- **The Creator** — wants a shareable link-in-bio for their socials/content. Cares about looks, speed, mobile.
- **The ArNS owner** — bought a name, wants something real at it *today*. Cares about pointing the name.
- **The community/project** — wants a permanent, censorship-resistant hub of links (docs, socials, token, app).
- **The crypto-native** — values permanence + verifiability + "not Linktree." Cares about provenance badge.

**Top use cases**
1. Personal link-in-bio at `myname.ar.io`.
2. Project hub (links to app, docs, X, Discord, contract).
3. Event / drop page (temporary content, permanent record).
4. A permanent, unkillable backup of an existing Linktree.

---

## 6. User stories

- As a new user, I can pick "Link in Bio," fill in my name/avatar/links, and publish — **without connecting anything until I publish**.
- As a creator, I see a **live preview** update as I type.
- As an ArNS owner, I can **point my name** (or an undername like `links_myname`) at my page during or after publishing.
- As a returning user, I can **open a page I made, edit it, and re-publish** a new version.
- As a user on a new laptop, I can still edit a page I made earlier because the console can **rebuild the editor from the on-chain page**.
- As a power user, I can add **custom Arweave tags** and organize my pages with **labels**.
- As anyone, I can **roll back** my ArNS name to a previous version of the page.
- As a viewer, the published page **loads instantly, works on mobile, and previews nicely** when shared to social.

---

## 7. Core experience (functional requirements)

### 7.1 The editor
A single-panel editor (`PagesPanel`, mirroring `DeploySitePanel`'s state-driven approach) with **two columns**: controls on the left, **live phone-framed preview** on the right (stacks on mobile).

Sections:
1. **Profile** — avatar (upload/crop, or emoji/initials fallback), display name, tagline, short bio.
2. **Links / blocks** — an ordered, reorderable list (drag handle) of **blocks** (see §7.3). Add/edit/delete/reorder. This is the "super flexible" core.
3. **Theme** — a set of presets + light customization (see §7.5).
4. **Page settings** — page title, SEO description, social/OG image, favicon emoji, custom tags, version note.

Requirements:
- Live preview reflects every change with no "render" button.
- All edits are local until publish (no network cost to experiment).
- Autosave the working draft to local state so a refresh doesn't lose work.
- "Start from" options: a **template** from the gallery (§7.4), **blank**, **duplicate an existing page**, or **import from a TX/ArNS** (re-hydrate — see §8.1). Whatever you start from, everything stays editable.

### 7.2 Page definition (the source of truth) — **key design decision**
The editor reads/writes a single versioned JSON object, the **PageDef**. This is the heart of making an "editor" work on immutable storage.

```jsonc
{
  "schema": "ario-console/page",
  "schemaVersion": 1,
  "id": "b1c2…",                 // stable page id (uuid), constant across versions
  "template": "creator",         // ORIGIN marker only — which template it started from; not a constraint
  "title": "Ariana's Links",
  "profile": {
    "displayName": "Ariana",
    "tagline": "builder // permaweb",
    "bio": "…",
    "avatar": { "kind": "dataurl", "value": "data:image/webp;base64,…" }
  },
  "blocks": [
    { "id": "…", "type": "link",    "label": "My site", "url": "https://…", "icon": "globe" },
    { "id": "…", "type": "social",  "items": [ { "platform": "x", "url": "…" }, … ] },
    { "id": "…", "type": "heading", "text": "Projects" },
    { "id": "…", "type": "image",   "src": "data:…", "alt": "…", "link": "https://…" },
    { "id": "…", "type": "embed",   "arweave": "ar://<txId or arns>" },
    { "id": "…", "type": "divider" }
  ],
  "theme": {                       // visual skin — independent of template
    "preset": "midnight",
    "buttonShape": "pill",         // pill | rounded | square
    "font": "body",                // body (Plus Jakarta) | heading (Besley)
    "colors": { "bg": "#…", "surface": "#…", "text": "#…", "accent": "#…" },
    "background": { "kind": "solid" } // solid | gradient
  },
  "layout": {                      // template-exposed knobs — all user-adjustable
    "headerAlign": "center",       // center | left
    "linkStyle": "button",         // button | card | grid
    "width": "standard"            // standard | wide
  },
  "meta": {
    "seoTitle": "Ariana's Links",
    "description": "…",
    "ogImage": { "kind": "dataurl", "value": "data:…" },
    "faviconEmoji": "🔗"
  },
  "createdAt": 0, "updatedAt": 0
}
```

**Where PageDef lives (3 places, deliberately redundant):**
1. **Embedded inside the published HTML** as `<script id="ario-pagedef" type="application/json">…</script>`. This makes every page **self-describing and portable** — the console (or anyone) can rebuild the exact editor state from the page itself. This is the mechanism that makes "edit from any device" and "import from TX" work.
2. **Cached locally** in the new `pages` store slice for instant re-open.
3. Its **hash** is recorded per version (for dedup / change detection).

> Note: PageDef is *not* stored as an Arweave tag — tags are size-limited. It rides inside the HTML body.

### 7.3 Blocks (content model)
v1 block types (each block is reorderable and individually editable):

| Type | Fields | Notes |
|---|---|---|
| `link` | label, url, icon?, style? | The core Linktree row (full-width button). |
| `social` | items[] of {platform, url} | Row of platform icons (X, GitHub, Discord, Telegram, YouTube, Instagram, TikTok, LinkedIn, email, custom). |
| `heading` | text | Section label. |
| `text` | text (plain/markdown-lite) | Short paragraph. |
| `image` | src, alt, link? | Inline image (data URI). |
| `embed` | arweave (ar:// txId or ArNS) | **ar.io-native**: embed permaweb content/another page. |
| `divider` | — | Visual separator. |

"Super flexible" = the block list is open-ended and reorderable; new block types can be added without schema breaks (unknown types render as no-ops in older renderers, so forward-compat is graceful).

### 7.4 Templates (opinionated starts, fully editable — "flexibility within")

**Templates and flexibility are not in tension — the block model makes them the same thing.** A template is nothing more than a **seed `PageDef`**: a curated arrangement of blocks (§7.3) + a paired theme (§7.5) + placeholder copy. Because the editor operates entirely on the block model, **everything a template sets up stays editable** — rewrite copy, add/remove/reorder blocks, swap the theme, change layout knobs. A template gives a polished 10-second head start; it never locks anything in.

**Two independent axes** (decoupling these is what delivers "flexible within"):
- **Template** = *content & structure* starting point — which blocks, in what order, with what placeholder copy and default layout.
- **Theme** = *visual skin* — colors, font, button shape, background.

Any theme works on any template, and vice-versa. A user can pick the **Project** template and the **Midnight** theme, then delete two blocks and add three — and it all still renders cleanly.

**Three levels of flexibility inside every template:**
1. **Content** — edit/replace all text, links, and images.
2. **Structure** — add, delete, and reorder any block. The template's arrangement is a *starting point, not a fixed layout*. Even the profile header is an editable/removable anchor block.
3. **Style & layout** — swap theme; tune accent color, button shape, font, background; toggle the template's **layout variants**.

**Layout variants (per-template knobs).** Each template exposes a few layout options that are simply presets of existing `PageDef.layout` / `theme` fields — so the renderer needs *zero* special-casing per template:
- `headerAlign`: centered · left
- `linkStyle`: button · card · grid
- `width`: standard · wide
- `background`: solid · gradient (image in v2)

**Template catalog (v1) — 16 templates across four families.** Ideated by Fable, then designed + developed by a per-template agent team. Every one is a single self-contained HTML file (7–13 KB → free-tier), inline-CSS-only (no external assets), mobile-first, accessible, and fully editable on the shared block engine. Live gallery: `docs/pages-templates/gallery.html` (published Artifact); seeds + CSS skins in `docs/pages-templates/registry.json`; sample pages in `docs/pages-templates/<id>.html`.

| Family | Template | `id` | Signature |
|---|---|---|---|
| **Classic-era internet** | Dial-Up Homestead | `dial-up-homestead` | 1997 GeoCities starfield, beveled buttons, under-construction banner |
| | Midnight Tower BBS | `midnight-tower-bbs` | amber-phosphor BBS, box-drawing frames, CRT scanlines |
| | Chrome Dreams | `chrome-dreams` | vaporwave sunset over a chrome perspective grid |
| | Top 8 | `top-eight` | 2006 social profile — mood line + a Top 8 grid |
| **Modern web** | Bento Deck | `bento-deck` | keynote bento grid, one tile flooded with color |
| | Aurora Glass | `aurora-glass` | frosted-glass cards drifting over a slow aurora |
| | Raw Concrete | `raw-concrete` | brutalist — giant type, hard offset shadows |
| | The Masthead | `the-masthead` | Sunday-magazine front page, nameplate + drop cap |
| | Grid System | `grid-system` | Swiss poster math, one disciplined red accent |
| **Developer** | Shell Session | `shell-session` | live SSH session; sections are command output |
| | README.md | `readme-md` | life as a repo — shields badges, contribution graph |
| | man yourname | `man-page` | your personal `man(1)` page, honest BUGS section |
| **Wildcards** | Side A | `side-a` | a cassette J-card; links are the tracklist |
| | Xerox Riot | `xerox-riot` | photocopied punk zine, taped down crooked |
| | T-Minus | `t-minus` | mission-control launch board holding at T-minus |
| | The Arcana | `the-arcana` | a gilded tarot card for your internet self |

The five conceptual archetypes from earlier drafts (Creator, Project/DAO, Profile, Portfolio, Blank) are all covered by this set; "Blank" remains available as a from-scratch start. A smaller **featured** subset can lead the gallery at launch with the rest one scroll down (see §17).

**Guardrails — why flexibility doesn't yield broken pages:**
- Templates ship opinionated and look great out of the box (curated theme + layout pairings).
- The renderer is responsive and enforces consistent spacing/typography, so *any* block combination still renders acceptably on mobile and desktop, light and dark.
- **Non-destructive controls:** "Reset to template" restores the seed without losing the page's id or domain; "Duplicate" branches a page instead of overwriting.
- The `template` field is a **provenance marker only** (surfaced as the `Page-Template` tag) — informational, never a constraint on what the user can do.

**Extensibility.** A template is just a seed `PageDef` in a registry (`src/features/pages/templates/`). Adding one requires **no renderer changes** — this is how the gallery grows (profile card, landing, event…) over time.

### 7.5 Themes
- Ship **5–6 presets** (e.g. Minimal Light, Midnight, Gradient, Terminal, ar.io Brand, Paper).
- Light customization: accent color, button shape (pill/rounded/square), font (the two already-loaded families — Besley / Plus Jakarta Sans), solid vs gradient background.
- Every theme must be **mobile-first, responsive, and render correctly in light/dark**, matching `docs/STYLE_GUIDE.md`.

### 7.6 HTML generation & upload (**fits single-file flow**)
A pure function `renderPageHtml(pageDef) → string` produces **one self-contained HTML document**:
- Inline `<style>`; **no external requests** (no CDNs/fonts/scripts fetched at view time) so it is permaweb- and CSP-safe and loads instantly.
- Fonts: system stack by default; optionally inline a subset of the brand fonts (size-guarded).
- Images (avatar/OG/inline) embedded as **optimized data URIs** (client-side resize/compress to WebP; hard size guard, see §12).
- `<head>` includes **SEO + Open Graph + Twitter Card** meta and the favicon (emoji → data-URI favicon), so shared links preview well.
- The embedded `<script id="ario-pagedef">` block for editability.
- Optional tiny inline JS only for non-critical enhancement; page is fully functional with JS disabled.

Then it flows through the **existing single-file path**:
```ts
const html = renderPageHtml(pageDef);
const file = new File([new Blob([html], { type: 'text/html' })], `${slug}.html`, { type: 'text/html' });
const result = await uploadFile(file, { customTags });   // useFileUpload — same as any upload
```
This is the same Blob→File→`turbo.uploadFile` pattern already used for the Deploy manifest (`useFolderUpload.ts`) and the Capture PNG (`turboCaptureClient.ts`). Because it's a single data item, **ArNS can point directly at the HTML TX** — no manifest needed for the text-only case.

> If a page carries multiple large media items and we choose to store them as separate data items (v2), the publish switches to the folder/manifest path (`useFolderUpload`) transparently. v1 keeps everything in one file.

### 7.7 Versioning (like Deploy Site)
Model mirrors Deploy Site's "every publish is a new immutable TX," but **grouped under a stable page id** (cleaner than `deployHistory`'s flat array):

- Each **Publish** uploads a new HTML TX → appends a **PageVersion** to the page.
- Re-publishing an existing page keeps the same `page.id`; increments `currentVersion`.
- If the page has an ArNS name, publishing **re-points** the name to the new TX (opt-in checkbox "Update my domain to this version", default on).
- **Version history UI**: list versions (v3, v2, v1) with timestamp, size, note, TX link, and "This is live" indicator.
- **Rollback**: re-point ArNS to any previous version's TX (reuses `updateArNSRecord`). This is a differentiator — Deploy Site doesn't offer it today.
- **Smart dedup**: if the PageDef hash is unchanged since the last version, warn "no changes to publish."

### 7.8 ArNS assignment (like Deploy Site)
Reuse the exact Deploy patterns and components:
- **Pre-publish**: an ArNS selector (reuse/adapt `ArNSAssociationPanel`) to pick base name `@` or a new/existing **undername** (e.g. `links_myname`).
- **Post-publish**: reuse `AssignDomainModal` for "assign / change domain" from the success screen and the Pages dashboard.
- **Write path**: `useOwnedArNSNames().updateArNSRecord(name, pageTxId, undername?, ttl?)` → Solana `ant.setRecord`.
- **Constraint (inherited):** ArNS writes **require a Solana wallet** (primary or a **linked** Solana wallet). Gate with `useLinkedSolanaWallet` (`hasArNSAccess` / `needsLinking`) and show the same "Link wallet" banners Deploy uses.
- Undername sanitization via existing `utils/undernames.ts`. Deployed URL formats: base `https://myname.ar.io`, undername `https://links_myname.ar.io`.

### 7.9 Tags
Two kinds, both required:

**A. Standardized Arweave data-item tags** (always applied via `customTags` on `uploadFile`):
| Tag | Value |
|---|---|
| `Deployed-By` | `ar.io Console` (default) |
| `Deployed-By-Version` | package version (default) |
| `App-Feature` | `Pages` *(new value)* |
| `Content-Type` | `text/html` |
| `Type` | `page` |
| `Page-Id` | stable page id |
| `Page-Version` | integer |
| `Page-Title` | title |
| `Page-Template` | `link-in-bio` |
| `Render-With` | `ario-console-pages@1` (schema marker for re-hydration) |

**B. User tags/labels:**
- **Custom Arweave tags** — user adds `{name, value}` pairs (for discoverability/indexing), merged over defaults (the existing `mergeTags` helper already supports this).
- **Organizational labels** — free-text labels stored locally on the page record to filter/group the Pages dashboard (no chain cost). Satisfies "must allow them to add tags" for both on-chain and console-UI meanings.

### 7.10 Pages dashboard ("show all previous pages")
A `/pages` view listing every page the user created (from the `pages` store slice), newest first. Each card shows:
- Title + template, avatar thumbnail, live URL (ArNS if assigned, else gateway URL for `latestTxId`).
- Current version (v3), version count, last published time.
- ArNS status (assigned name/undername, or "No domain — Assign").
- Labels/tags.
- Actions: **Edit**, **Duplicate**, **Assign/Change domain**, **Version history**, **Visit**, **Verify** (deep-link to `/verify?tx=<txId>`), **Copy TX**, **Export**.
- Status pills (CONFIRMED/FINALIZED) via existing `useUploadStatus` + `uploadStatusCache`.

**Portability / recovery:** optionally offer "Find my pages" that queries the gateway GraphQL by owner + `App-Feature: Pages` to surface pages created on other devices, then re-hydrates them from their embedded PageDef.

Empty state: a friendly "Create your first page" CTA with template thumbnails (mirrors `RecentDeploymentsPage`'s empty state).

### 7.11 Payment
Reuse the whole payment stack unchanged:
- Cost = `useWincForOneGiB` × bytes + `usePerDataItemFee`, minus free tier (`useFreeUploadLimit` / `isFileFree`).
- A text-only page (a few KB) is typically **FREE** → prominently show a **"Free · Permanent"** badge. This is a headline selling point.
- Media-heavy pages that exceed the free per-item limit show cost and route through Credits / JIT / x402 exactly like Upload.
- After publish, dispatch `refresh-balance` (existing convention).

### 7.12 ar.io-native targets (ArNS + Arweave TX) — **first-class, not an afterthought**

A Pages page lives *on* the permaweb, so it must speak the permaweb natively. Any URL-bearing field — `link.url`, `profile.avatar`, `image.src`, and the `embed` block — accepts an **`ar://` target** in addition to normal `https:`/`mailto:`:

- **`ar://<txId>`** (43-char base64url Arweave transaction id) → renderer resolves to `https://<gateway>/<txId>` (gateway from config, default `arweave.net`).
- **`ar://<arns-name>`** or an ArNS name → resolves to `https://<name>.<arns-host>` (e.g. `https://myname.ar.io`), undernames as `https://<under>_<name>.ar.io`.

**What the renderer does:** stores the portable `ar://` form in the PageDef, emits the **resolved gateway URL** in the published HTML (`href`/`src`) so the page works in any browser without a resolver extension, and tags the element `data-ar="ar://…"` to preserve native intent (used for re-hydration and future in-app ar:// routing).

**Native hooks every page gets:**
1. **ArNS identity** — the page can display/link its own ArNS name as its canonical handle (`myname.ar.io`).
2. **`ar://` links** — link blocks can point at other permaweb pages/content or ArNS names, not just the clearnet.
3. **`embed` block** — embeds permaweb content (image/page) by TX id or ArNS name (`<img>`/`<iframe>` on the resolved URL).
4. **Avatar/media by TX** — `avatar` and `image` may reference `ar://<txId>`, so a user's own permaweb data items back their page (very on-brand vs. data-URI-only).
5. **Permanence / Verify hook** — an optional, opt-in on-page "Permanent on Arweave · Verify" affordance linking to the page's own TX and to `/verify?tx=<txId>` (this is the on-page verify block from decision §17.5; off by default).

**Applies to templates too:** every one of the 16 launch templates ships these hooks woven into its own aesthetic (an ArNS-native link, the identity handle, and the verify affordance), so ar.io-native usage is the *default* a user sees — not something they have to discover. Editor URL inputs accept `ar://`/ArNS or clearnet interchangeably with inline resolution preview.

---

## 8. Additional core requirements I'm adding (the "what's missing")

The brief named: link-in-bio, quick/easy/flexible, fits upload flow, list previous pages, tags, versions, ArNS. Here are the **core things a solid v1 also needs** that weren't in the brief:

1. **Editability & source of truth (§7.2).** Immutable storage means "edit" = "generate a new version." That only works if the page is *self-describing*. Embedding the PageDef in the HTML + caching locally is the load-bearing decision that makes editing (and cross-device editing, and import) possible. **Without this, "versions" and "edit" don't actually work.**
2. **Media handling & size discipline (§12).** Avatars/images must be client-side resized/compressed to keep pages small (free) and fast. Hard cap with clear UX when a page would exceed the free tier or a sane byte ceiling.
3. **SEO / Open Graph / favicon.** A link-in-bio page's whole job is to be *shared*. Generated HTML must include OG/Twitter meta + title + favicon so it previews correctly on social. Non-negotiable for this genre.
4. **Mobile-first, responsive, a11y, light/dark.** Link-in-bio traffic is overwhelmingly mobile. Themes must be responsive and accessible (contrast, focus states, semantic markup).
5. **Rollback / re-point to previous version (§7.7).** Cheap to offer (ArNS re-point is the only mutable surface) and a real differentiator.
6. **Duplicate & import (§7.1).** Duplicate an existing page as a starting point; import/re-hydrate from a TX or ArNS name.
7. **"Free · Permanent · Verifiable" framing.** Surface the free-tier status, the permanence, and a **Verify badge** (link to `/verify?tx=`). This is the reason to use ar.io over Linktree; make it visible in-product and optionally on the page itself.
8. **Wallet capability & gating clarity.** A user can *create & publish* a page with **any** wallet (it's an upload), but **assigning ArNS requires Solana** (primary/linked). The UX must make "publish now, attach a name when you connect Solana" a smooth path, not a dead end.
9. **Analytics (lightweight, honest).** No server means no true click analytics. Options to note (not v1-blocking): (a) links pass through the gateway's standard access logs; (b) a future opt-in redirect/counter service. Set expectations rather than promise Linktree-style dashboards.
10. **Content safety & ToS.** Pages are public and permanent. Add a publish-time acknowledgment (no illegal content, permanence is irreversible) consistent with existing upload disclaimers.
11. **Slug / URL preview.** Before ArNS is attached, the page lives at a gateway URL (`getArweaveUrl(txId)`); show it and make it copyable, with a clear "attach your name for a pretty URL" nudge.
12. **Draft persistence & recovery.** Autosave working draft; warn on navigate-away with unsaved changes.

---

## 9. Detailed flows

### 9.1 Create & publish (happy path)
1. User opens `/pages` → "Create page" → picks a **template** from the gallery (Creator, Project/DAO, Profile, Portfolio, or Blank).
2. Editor opens with a starter page; user edits profile, adds link blocks, picks a theme. Live preview updates.
3. (Optional) User expands **Domain** and selects an ArNS name/undername (if Solana available) — or skips.
4. (Optional) User expands **Advanced** → custom tags, version note, SEO/OG.
5. User clicks **Publish** → confirmation modal shows size, **cost (likely FREE)**, target domain, payment tab (credits/crypto) if billable.
6. Console generates HTML, uploads via `uploadFile` → gets `txId`. If a domain was chosen and Solana is available, `updateArNSRecord` re-points it.
7. **Success screen**: live URL (ArNS or gateway), TX id, "Visit page," "Copy link," Verify badge, "Assign a domain" (if not done), "Create another."
8. Page is recorded in the `pages` slice (version 1). `refresh-balance` dispatched.

### 9.2 Edit & re-publish
1. From `/pages`, click **Edit** on a page.
2. Editor hydrates from local PageDef cache; if absent (new device), fetch `latestTxId` HTML from the gateway, parse embedded PageDef, hydrate. If neither works, offer "start fresh with this page's id."
3. User edits → **Publish** creates version N+1 (new TX). If page has a domain, prompt/confirm re-point (default on).
4. Version history updated; dashboard reflects new current version.

### 9.3 Assign / change / rollback domain
- Reuse `AssignDomainModal` for assign/change.
- Version history → "Make live" on an older version → `updateArNSRecord` to that version's TX → records a re-point.
- All ArNS actions gated on Solana access with existing linking banners.

---

## 10. Data model & store changes

New persisted store slice (zustand, in `useStore.ts`, added to `partialize`). Grouped by stable page id rather than a flat list:

```ts
interface ConsolePage {
  id: string;                 // stable across versions (Page-Id tag)
  title: string;
  template: TemplateId;       // origin marker: 'creator' | 'project' | 'profile' | 'portfolio' | 'blank' | …
  currentVersion: number;
  latestTxId: string;         // newest HTML data item
  arns?: { name: string; undername?: string; targetTxId: string; arnsTxId?: string };
  versions: PageVersion[];
  def: PageDef;               // last-edited source of truth (local cache)
  labels: string[];           // organizational (local only)
  createdAt: number;
  updatedAt: number;
}

interface PageVersion {
  version: number;
  txId: string;               // HTML data item id
  size: number;
  defHash: string;            // hash of PageDef (dedup / change detection)
  note?: string;              // changelog note
  timestamp: number;
  arnsRepointTxId?: string;   // if this version was made live
}
```

Store actions: `savePage`, `addPageVersion`, `updatePageArNS`, `setPageLabels`, `duplicatePage`, `deletePage` (local only — cannot delete on-chain), `clearPagesHistory`. Reuse `uploadStatusCache` + `useUploadStatus` for TX status. Persist `pages` in `partialize` alongside `deployHistory`/`uploadHistory`.

Cache expiry: none for page records (they're user-created artifacts, like `deployHistory`). Status caching inherits existing 1h/24h rules.

---

## 11. Technical architecture (reuse map)

**Reused as-is:**
- `useFileUpload().uploadFile(file, { customTags, jitEnabled, selectedJitToken, … })` — the publish call.
- `useX402Upload` — billable pages on Base USDC / x402-only mode.
- Pricing: `useWincForOneGiB`, `usePerDataItemFee`, `useFreeUploadLimit` / `isFileFree` / `formatFreeLimit`.
- ArNS: `useOwnedArNSNames` (`updateArNSRecord`, undername support), `usePrimaryArNSName`, `useLinkedSolanaWallet`, `utils/undernames.ts`, `utils/arIOConfig.ts`.
- Components: `ArNSAssociationPanel`, `AssignDomainModal`, `ReceiptModal`, `DeployConfirmationModal` (adapt), status/receipt UI.
- URL helpers `getArweaveUrl` / `getArweaveRawUrl`; constants `APP_NAME`, `APP_VERSION`, `wincPerCredit`.
- Store patterns from `deployHistory` (persist, group, status cache).

**New:**
- `src/features/pages/` (mirrors `features/browse/` structure):
  - `PagesPanel.tsx` — editor + preview (state-driven like `DeploySitePanel`).
  - `components/` — `BlockList`, `BlockEditor`, `ThemePicker`, `TemplateGallery`, `LivePreview`, `PageCard`, `VersionHistory`.
  - `templates/` — one seed `PageDef` per template (`creator.ts`, `project.ts`, `profile.ts`, `portfolio.ts`, `blank.ts`) + an `index.ts` registry (id, name, description, thumbnail, default theme). **Adding a template = adding a file here; no renderer changes.** This is the mechanism behind "flexibility within templates" — templates are data, the block engine is the behavior.
  - `render/renderPageHtml.ts` — **pure** PageDef → self-contained HTML (the generator; keep it dependency-light and fully testable — this is the natural home for the first real Vitest suite, like `topupDeepLink.test.ts`).
  - `render/parsePageHtml.ts` — extract embedded PageDef from a fetched page (import/hydrate).
  - `schema.ts` — PageDef types (incl. `TemplateId`, `layout`) + `schemaVersion` migration helpers.
  - `hooks/usePagePublish.ts` — orchestrates render → `uploadFile` → record version → optional `updateArNSRecord` (analogous to `deployFolder`'s orchestration).
- `src/pages/PagesPage.tsx` — route wrapper.
- Store slice per §10.
- Route `/pages` in `App.tsx`; nav entry; a dashboard "Create a Page" card. Consider a "Create a page instead?" affordance in `UploadPanel` since it "fits the upload flow."

**Render safety requirements for `renderPageHtml`:**
- Escape all user strings (XSS-safe); URLs validated/normalized (existing `validator` dep) and constrained to safe schemes (`https:`, `mailto:`, `ar://`).
- No external network dependencies at view time.
- Deterministic output (stable ordering) so identical PageDef → identical bytes → dedup works.
- Include the `<script id="ario-pagedef">` and OG/meta/favicon.

---

## 12. Media & size discipline

- Avatars/images: client-side crop + resize + re-encode to **WebP**, capped dimensions (e.g. avatar ≤ 512px, inline images ≤ 1280px), quality-tuned so a typical page stays **under the bundler free per-item limit** (`freeTier.maxItemBytes`).
- Show a **live size meter** in the editor with a clear threshold marker at the free-tier limit ("Still free" → "This will cost X credits").
- Hard ceiling on total single-file size (configurable; e.g. warn at 100 KB, block/redirect to media-as-separate-TX v2 path above some MB). Never silently produce a huge page.
- OG image: auto-generate from avatar + name if the user doesn't supply one.

---

## 13. Wallet capability matrix (Pages)

| Action | Arweave | Ethereum/Base/Polygon | Solana |
|---|---|---|---|
| Create / edit / preview (local) | ✅ | ✅ | ✅ |
| Publish page (upload) | ✅ | ✅ | ✅ |
| Pay when billable | ✅ credits/AR-ARIO | ✅ credits / JIT / x402 | ✅ credits / JIT SOL |
| Assign / change ArNS | ❌* | ❌* | ✅ |
| Rollback (re-point ArNS) | ❌* | ❌* | ✅ |

\* Requires a **linked Solana wallet** (existing `useLinkedSolanaWallet` gating). Publish is fully available to all wallets; only the domain step needs Solana — surface this as "publish now, attach your name after linking Solana," never a hard block on publishing.

---

## 14. Edge cases & constraints

- **No changes since last version** → block publish with "nothing to publish" (PageDef hash match).
- **Publish succeeds, ArNS re-point fails** (Solana popup rejected / network) → page is live at gateway URL; show partial-success state and a retry (mirror Deploy's skippable ArNS stage + `arnsStatus: 'failed'`).
- **Edit on new device, no local cache, gateway fetch fails** → offer manual TX id import or "start fresh (same page id)."
- **Undername collisions / invalid chars** → existing sanitization + validation.
- **Very large media** → size guard blocks or routes to manifest path (v2).
- **Free tier changes** (per the new `freeTier` model) → cost UI reads live values; never hardcode limits.
- **Wallet switch mid-session** → clear caches per existing `useWalletAccountListener` / `clearEthereumTurboClientCache` conventions.
- **XSS via link labels/URLs** → strict escaping + scheme allowlist in the renderer.
- **Deleting a page** → only removes the local record; on-chain versions are permanent (make this explicit).

---

## 15. Success metrics

- **Activation:** % of users who open Pages and publish ≥1 page; time-to-first-publish (target < 60s).
- **Free-tier leverage:** % of pages published for free.
- **ArNS attach rate:** % of published pages pointed at an ArNS name (drives name demand).
- **Return editing:** % of pages with ≥2 versions.
- **Downstream:** ArNS names registered attributable to Pages; credits purchased for media-heavy pages.
- **Distribution:** count of on-chain `App-Feature: Pages` items over time.

---

## 16. Phased rollout

**MVP (v1)** — **template gallery of ~5 editable templates** (Creator, Project/DAO, Profile, Portfolio, Blank) on a shared block engine, with **template↔theme decoupling** and **layout variants** (§7.4); profile + link/social/heading/text/divider blocks; 5 themes; single self-contained HTML publish through the existing upload flow; free-tier aware; Pages dashboard; versions + version history; ArNS assign/change/rollback (Solana-gated); custom tags + labels; SEO/OG/favicon; embedded PageDef + edit + duplicate + "reset to template"; verify badge.

**v1.1** — Import/re-hydrate from TX/ArNS; "Find my pages" via GraphQL; image block; OG auto-generation; more themes; size meter polish.

**v2** — `embed` block (permaweb content), multiple/large media as separate data items + manifest, richer theming (custom fonts/backgrounds, image backgrounds), **more templates** (event/drop, landing, profile card) and per-template layout variants, lightweight view counting.

**Later** — collaboration, per-block scheduling/expiry, gated links, analytics service.

---

## 17. Resolved decisions

Each decision is locked against existing ar.io Console conventions (evidence in parentheses). #4 and #7 confirmed directly by product.

| # | Question | Options weighed | **Decision** | Grounded in |
|---|---|---|---|---|
| 1 | Name | Pages · Profile/Bio · Links/LinkHub | **"Pages"** — route `/pages`; nav label **"Create Page"** (verb-noun, like the others) | Header `accountServices` labels: "Upload Files", "Deploy Site", "Capture Page" |
| 2 | Publish format (v1) | Single self-contained HTML · manifest + separate assets · hybrid | **Single self-contained HTML** — one `text/html` data item; ArNS points straight at the TX; manifest path deferred to v2 | `useFileUpload.uploadFile` single-item path; `useFolderUpload` manifest reserved for multi-file |
| 3 | Editable source | Embed PageDef in HTML + local cache · local cache only · separate JSON TX/tag | **Embed PageDef JSON in the page + local cache** — self-describing like the Deploy manifest; enables edit/cross-device/import/rollback | Deploy manifest is self-describing JSON uploaded as content (`useFolderUpload`); tags are size-limited |
| 4 | Analytics | None/private · opt-in counter | **None. Private by default.** No counter in v1; marketing may position "no tracking" | Zero analytics/telemetry anywhere in `src/` — confirmed by product |
| 5 | Verification | Auto on-page badge · in-console only · opt-in block | **In-console** — "Verify" action in the Pages dashboard → `/verify?tx=`; **no** auto-branding of the user's page; optional "Verified permalink" **block** (off by default) | Console tags content metadata (`Deployed-By`) but never watermarks output; Verify is a first-class utility (`utilityServices`) |
| 6 | Entry points | `/pages` only · + UploadPanel cross-link | **`/pages` route + "Create Page" in `accountServices` + a dashboard activity section** — no UploadPanel cross-link | Every creation action is its own menu item + route + Recent* surface (`Header.tsx`, `account/RecentDeploymentsSection`) |
| 7 | ToS | New checkbox · reuse existing inline pattern | **Reuse existing pattern** — inline "By publishing, you agree to our Terms of Service" + permanence note at confirm; no new checkbox | `DeploySitePanel.tsx:890`, `TryItNowPanel.tsx:477` (link `https://ardrive.io/tos-and-privacy/`) — confirmed by product |
| 8 | Launch templates | 1 template · small gallery · large library | **16-template library** across 4 families (§7.4), all on the shared block engine with layout knobs; a **featured subset** may lead the gallery at launch | Templates are cheap seed data; block model keeps all 16 flexible; console ships whole features, not teasers |
| 9 | ArNS/TX support | clearnet-only · ar://+ArNS as first-class | **First-class `ar://` + ArNS** resolution in every URL field, the `embed` block, avatar/media-by-TX, and an opt-in verify hook (§7.12); all 16 templates ship the hooks | It's an ar.io-native feature — permaweb targets must be default, not bolted on |
| 10 | Mobile | — | **Mobile-first, verified** — all templates carry viewport + `@media` breakpoints + fluid layout; no horizontal-overflow widths | Confirmed by static analysis across all 16 sample pages |

**Publish-step microcopy (verbatim reuse of the console pattern):**
> Once published, this page will be publicly accessible and cannot be removed. By publishing, you agree to our [Terms of Service](https://ardrive.io/tos-and-privacy/).

---

## 18. Out of scope (explicit)
Full website builder, multi-page sites, DNS custom domains, server analytics, collaboration, marketplace, e-commerce/paywalls, email capture. Deploy Site remains the tool for pre-built/multi-page sites; Pages is the zero-file, in-console creator.
