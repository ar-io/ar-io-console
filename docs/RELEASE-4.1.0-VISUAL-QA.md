# 4.1.0 visual QA — prompt for a Windows agent

Everything below was written by an agent working in WSL that **could not render the
app**: `node_modules` holds win32-x64 binaries while that shell is linux-arm64, so
`vite`, `vitest` and `rollup` all fail to start. Type-check, lint and direct
Tailwind/PostCSS compilation passed; **nothing has been seen on screen and no test
or production build has been run.**

Paste the prompt below into an agent running on Windows in `C:\source\ar-io-console`.

---

## PROMPT — copy from here

You are picking up a release candidate that has been verified statically but never
rendered. Your job is to run it, prove it works, and finish the pixel-level design
pass that could not be done without a browser.

**Repo:** `C:\source\ar-io-console` · **Branch:** `fix/arns-solana-wallet-gate` ·
**Version:** 4.1.0 (unreleased)

### Step 0 — establish the baseline (do this before touching anything)

```
npm ci --legacy-peer-deps
npm run type-check
npm run lint
npm test
npm run build
```

`type-check` and `lint` are expected to be **completely clean** — zero errors, zero
warnings. If either reports anything, that is a regression introduced by the brand
pass; fix it before continuing.

`npm test` and `npm run build` have **not been run at all** in this cycle. They are
the single largest unknown in this release. If either fails, stop and report before
doing any visual work.

Then `npm run dev` and open http://localhost:3000.

### Step 1 — verify the things most likely to be broken

These are ranked by risk, because they were written blind. Check them first.

1. **Full-bleed section bands.** The homepage has four bands that break out of the
   1400px rail using `width: 100vw; margin-inline: calc(50% - 50vw)` (the
   `.full-bleed` utility in `globals.css`). `100vw` includes the scrollbar, and the
   overhang is absorbed by `overflow-x-clip` on Layout's root.
   - Confirm **nothing scrolls horizontally**, at 1920px, 1440px, 1280px, 768px and 390px.
   - Confirm the **sticky header still sticks**. `clip` was chosen over `hidden`
     precisely because `hidden` would make the root a scroll container and break it —
     verify that reasoning actually holds in Chrome, Firefox and Safari/iOS.
2. **Modal keyboard behaviour** (`BaseModal`, ~20 consumers, entirely rewritten).
   For at least Upload confirm, Deploy confirm, Wallet selection, and one ArNS
   manage modal:
   - `Esc` closes it.
   - `Tab` cycles **within** the modal and never reaches the page behind.
   - The page behind does not scroll while it is open.
   - Focus returns to the triggering element on close.
   - **Nested case:** open Wallet Selection, trigger a connection so
     `BlockingMessageModal` appears on top. One `Esc` must close **only** the top
     modal — and the spinner is `dismissible={false}`, so Escape and backdrop-click
     should do nothing while it shows. This stack logic is the most intricate thing
     written blind.
3. **Hero legibility.** The clouds photo now sits on `#0e0a1c` at 70% opacity with a
   gradient overlay. It was tuned by arithmetic, not by eye. Check white body copy
   over the *brightest* part of the clouds — target ≥4.5:1. Adjust the overlay stops
   in `src/components/HeroBackground.tsx` if it reads thin.
4. **Modal scrolling.** The panel changed from `overflow-hidden` to
   `overflow-y-auto` with `max-h-[90vh]`. Open the tallest modal you can find
   (Receipt, Undernames, Controllers) on a short window and confirm content scrolls
   rather than clipping, and that rounded corners still clip cleanly.

### Step 2 — the pixel pass that could not be done

Walk **every route** and **every modal**. Routes: `/`, `/topup`, `/upload`,
`/capture`, `/deploy`, `/deployments`, `/pages`, `/share`, `/domains`,
`/domains/:name`, `/my-domains`, `/arns`, `/returned-names`, `/pricing`,
`/balances`, `/account`, `/settings`, `/try`, `/browse`, `/verify`.

At 1440px and 390px, look for what static analysis cannot see:

- **Optical spacing** — bands use `py-14 sm:py-20`; does that read as balanced
  against each section's own internal padding, or are some cramped/airy?
- **Band seams.** Adjacent bands are grouped so they abut with no white stripe
  (the page root's `space-y-12` would otherwise cut a gap through them). Confirm
  ArNS→Pricing and Journey→Agents meet cleanly, with no hairline.
- **Heading weight.** Every `h1`–`h6` should now be Besley **800**. If any heading
  looks lighter than its neighbours, something is still applying `font-bold`.
- **Focus rings.** Tab through each page. Every interactive element should show a
  2px purple outline that **follows border-radius**. On dark surfaces it should be
  lavender `#D4C6FF`, not purple. Flag anything with no ring, or a square ring on a
  rounded control.
- **20px card radius** — cards moved from 16px. Check nothing looks inconsistent
  where a card sits inside another rounded container.
- **Reduced motion.** Enable it in OS settings; confirm the carousel and all
  transitions stop.

### Step 3 — known-remaining items (not yet done, decide if they matter)

- **~46 raw Tailwind status colours** (`text-green-600`, `bg-red-500/10`) still
  bypass the `--color-success`/`error`/`warning`/`info` tokens. The style guide was
  corrected so no *new* ones appear; migrating the existing call sites is
  outstanding. Concentrated in `Header.tsx` and `features/browse/`.
- **The panel-header pattern is inlined in ~13 panels** rather than extracted into a
  `<PanelHeader>` component. This was deliberately *not* done blind: each copy has
  small variations, and unifying them without being able to see the result risks
  silent visual regressions. Do it now that you can see them — it's the reason
  heading weights drifted in the first place.
- **`VerificationBlockedModal`** hand-rolls its own backdrop instead of using
  `BaseModal`, so it inherits none of the new keyboard handling. It intentionally
  has no backdrop-dismiss (it's a security warning with three explicit actions), so
  it could now adopt `BaseModal` with `dismissible={false}`.

### Ground rules

- Do **not** run `npm install` in WSL; it will replace the win32 binaries.
- Report what you actually observed. If you did not look at a route, say so rather
  than implying coverage.
- Prefer fixing the shared component over patching call sites — `BaseModal` and
  `globals.css` are where leverage lives.

## PROMPT — copy to here
