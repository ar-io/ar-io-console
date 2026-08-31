# Changelog

All notable changes to the ar.io Console are documented in this file.

## [Unreleased]

### Changed
- **Buying and running an ArNS name no longer needs SOL.** Turbo pays the
  Solana fees and rent; you pay in Turbo Credits and the name is minted
  straight to your wallet. Turbo holds nothing, so there is no claim step and
  nothing to transfer out later. Signing in with an email address already
  creates a Solana wallet, so someone who has never held cryptocurrency can buy
  a name and keep it.
- **Prices now show the total.** A registration carries a one-time setup charge
  covering the Solana deposit Turbo fronts, and it is shown as its own line.
  Quoting the name price alone understated a purchase by more than half.
- **Renewing, upgrading and adding undername slots need no wallet approval at
  all** — they settle from credits with nothing to sign.
- **Turbo-custodied names are gone**, along with the claim flow that existed to
  get out of them. Sponsorship removes the reason they existed.

### Fixed
- **Renewal was blocked for wallets holding no SOL.** The check that made sense
  when the wallet paid its own fees was still gating a payment Turbo now
  covers, so a name could become un-renewable — and an un-renewable lease is a
  name eventually lost.
- **Record edits could write empty values over fields you never opened.** Saves
  sent every metadata field rather than the ones that changed.
- Some wallets return a signature in a wrapper the service could not read, so
  approvals from them failed as though the wrong wallet was connected.

### Notes
- Four actions still need a small amount of SOL: setting a primary name,
  releasing a name, pointing it at a different name token, and editing the
  name's own details. Buying from an auction and paying in ARIO also use your
  own SOL. Each says so before you commit.
- Controllers can still edit records, and pay their own network fee for it —
  Turbo covers the owner's fees only.

## [4.6.0] - 2026-08-28

### Fixed
- **Deep links returned 404 on console.ar.io.** `/try`, `/upload`, `/arns` and
  `/settings` failed while the root loaded fine. An `arweave/paths` manifest
  serves only the paths it lists, so a single-page app needs a `fallback`
  entry; the 4.5.0 manifest had none. `ario-deploy` derives that fallback from
  a `404.html` in the deploy folder, which the build never produced — the same
  step had been added to the GitHub Pages workflow and not carried across to
  the Arweave one. Only direct arrivals were affected; in-app navigation was
  always fine.

### Added
- **Email sign-in now creates an embedded Solana wallet** alongside the
  Ethereum one, so someone who has never installed a wallet can still sign ArNS
  writes. Added rather than swapped: Turbo credits belong to an address, so
  changing an existing email user's identity would strand the balance they
  hold. Privy builds a Wallet Standard wallet but never registers it, and the
  Solana adapter discovers wallets only through that registry — so it existed,
  could sign, and was invisible. `PrivySolanaBridge` registers it, which means
  Phantom, Solflare and Privy all arrive through the same hook and no ArNS code
  needs a Privy-specific branch.

### Changed
- **CodeRabbit reviews pull requests into `develop`.** It only auto-reviews the
  default branch by default, and under `feature → develop → main` that is the
  one branch PRs never target first — so reviews were happening after the
  decision instead of before it.

## [4.5.0] - 2026-08-27

### Added
- **Buy an ArNS name without leaving the console.** Search, price and purchase
  in one place, replacing the deep-link out to `arns.ar.io`. Payment is a flat
  row of equals — Card, ARIO, SOL, or an existing Turbo Credits balance — rather
  than a credits-versus-tokens fork, because "how do I pay" is one question.
  ARIO carries a "Best price" badge: it pays the registry directly and never
  touches the Turbo infrastructure fee, so it is cheaper *by construction*
  rather than by a market rate that could invert.
- **Card purchases settle in one step.** The bundler's fiat quote route prices
  the name, charges the card and registers it, instead of routing through a
  generic credit top-up.
- **Sortable Domain, Status and Expires columns** on My Domains. Status sorts by
  urgency rather than alphabetically — A–Z buries the row you need to act on
  between two you don't — and a name that never expires sorts last rather than
  first.
- **A staging environment.** `develop` publishes to GitHub Pages, `main`
  publishes the live console via ar.io. The flow is feature → develop → main.

### Changed
- **Turbo-custodied purchases are retired.** They removed the need to hold SOL
  but never the need for a wallet to sign with, and every sub-flow was broken as
  written. Sponsored gas removes the SOL requirement without handing Turbo the
  asset, a surcharge, a reduced action set and a claim flow, so custody waits for
  that rather than being repaired. Card buyers now need a Solana wallet holding
  the network deposit.
- **Dollars lead on every priced surface.** The ARIO/USD toggle is gone: it only
  chose which of two values was bold — both were always rendered — and it
  governed the name price while the *total* stayed in credits or SOL, which is
  the number the toggle existed to convert.
- **Network costs are quoted as an upper bound** ("up to ~0.0152 SOL"). The
  SDK's estimate is deliberately conservative, so a wallet quoting less is
  expected rather than a discrepancy.
- **One title per modal.** Every step panel shipped its own page-level header
  because they were written as sections of `/topup`; embedded, each restated the
  modal's title. All twelve modals now share one `ModalHeader`.

### Fixed
- **Buying with credits debited the wrong address.** The checkout read the
  balance for the session address while the purchase authenticated with the
  linked Solana wallet, so an Arweave or Ethereum holder was shown their own
  balance and charged an address holding nothing. Renewals and upgrades had the
  same split.
- **A wallet reconnect wiped the credit balance every store reader saw.**
  `setAddress` zeroed it and is re-called for the same session; nothing restored
  it, because the sync effect watched the query value, which had not changed.
  The header stayed correct while the checkout silently dropped its Balance
  option.
- **The Pay button did nothing on the card path.** Skipping the amount step also
  skipped the only place the Stripe PaymentIntent was created, and the guard that
  caught it returned without a word.
- **Transaction ids resolved against the wrong host.** Any non-localhost host was
  assumed to be an ar.io gateway, so ArNS profile logos 404'd anywhere the app
  was served statically.
- **Domain expiry read "in 0 days"** for leases years away — seconds compared
  against milliseconds.
- **Long names ran under the Type column** on the browse table.

### Removed
- The ARIO/USD price toggle and its persisted preference.
- Custodial ArNS purchases (see above).

## [4.4.2] - 2026-08-23

### Changed
- **Every RPC endpoint is now overridable at build time.** Only Solana was; the
  rest were hard-coded free public RPCs — `mainnet.base.org` alone backed three
  tokens *and* the wallet connector, and Base's own docs say it is not for
  production. Those endpoints rate-limit aggressively, which makes them the
  likeliest source of 429s. `VITE_ETHEREUM_RPC`, `VITE_BASE_RPC` and
  `VITE_POLYGON_RPC` join `VITE_SOLANA_RPC`; each falls back to the endpoint it
  replaced, so an unset var changes nothing.
- **One source of truth per chain.** `RPC_ENDPOINTS` in the store now feeds both
  the `tokenMap` and wagmi's transports, so balance reads and wallet operations
  can no longer drift onto different providers. `usdc` was pointing at a third
  Ethereum endpoint (`cloudflare-eth.com`) and now shares the Ethereum one.

  Two `rpcUrls` are deliberately left public: they are `wallet_addEthereumChain`
  parameters, so the URL is kept by the *user's wallet* and polled independently
  from then on. Pointing those at a paid provider would put every user's
  MetaMask on our quota.

## [4.4.1] - 2026-08-22

### Fixed
- **Native Solana wallets were signed out on every page reload.** The Solana
  provider runs with auto-connect off, and only *linked* wallets persisted the
  adapter name needed to restore them — primary sessions persisted just the
  address, so there was nothing to reconnect and the session was cleared on
  mount. The identity ArNS is actually built for had the worse experience of the
  two. Both now persist the adapter name and share one reconnect path; sessions
  saved before this change are cleared once, then it stops. Reported as ArNS
  names going missing during a site deploy or file upload — the names were fine,
  the session was not.

### Changed
- **The Solana write RPC transport is reused instead of rebuilt per call.** Each
  write action (buy, renew, set record, transfer, controllers, undernames…) was
  creating a fresh RPC client and a fresh WebSocket, and nothing closed them, so
  a session doing several writes accumulated connections against the provider's
  limit. The read clients were already shared for exactly this reason. Only the
  transport is cached — the SDK client is still built per call with the caller's
  signer, so it can never sign with a stale wallet.

## [4.4.0] - 2026-08-19

### Removed
- **The `/verify` page.** It was backed by a third-party service we do not
  maintain (`verifyApiUrl`, pointing at `vilenarios.com/local/verify`), so the
  page could break without warning and nobody would be on the hook to fix it.
  Shipping a tool that asserts authenticity is worse than shipping none when the
  thing behind it is unowned. Removed with it: the "Verify Data" header nav
  entry, the `verifyApiUrl` config field and its Developer Resources input, and
  the two Pages menu items that deep-linked into it.

  **Browse is now the single verification surface** — it already does
  cryptographic verification through Wayfinder, and the intent is that it grows
  to cover what the standalone page did. `/verify` falls through to the
  catch-all, so old links land on the homepage instead of erroring.

  The Pages "Verify" buttons were dropped rather than repointed: both surfaces
  already link to the live page, and for a published page the transaction *is*
  the page, so a gateway link would have duplicated a link already sitting next
  to it. The transaction id is still copyable on both, and Browse accepts one.

## [4.3.0] - 2026-08-18

**Finishing an upload now tells you where the file went, and offers to name
it.** Minor rather than patch because Upload gained a capability it never had:
before this, it was the only one of the three upload surfaces with no ArNS
prompt anywhere in its flow.

### Added
- **A result card when a single file finishes.** The permanent link is the
  lead content, copyable, alongside Copy TX ID for the transaction id — the one
  value you could not get by clicking the link. The panel header swaps to a
  success header the way Deploy Site's does, so the panel reports the outcome
  instead of a toast that vanishes.
- **"Add a domain" at the point it matters.** Deploy and Capture already
  prompted for an ArNS name; Upload's only path was an unlabelled globe icon on
  a collapsed Recent row, which almost nobody found. The prompt reuses Deploy's
  wording and drives the existing assign-domain modal, so naming reads and
  behaves the same on every surface.

### Changed
- The file picker hides while a result is on screen, and **Upload Another**
  brings it back — Deploy Site already hid its picker on success. Uploads of two
  or more files are unchanged: there is no single URL to feature and no single
  target for a name, so that path keeps its summary message and expands Recent.

## [4.2.1] - 2026-08-18

### Fixed
- **The page could stop scrolling after connecting a wallet.** Every modal
  saved the pre-lock value of `body.overflow` for itself, so a modal opening on
  top of another saved `hidden` and, if it was the last one out, restored
  `hidden` — locking the app until a reload. Wallet connection hits this
  exactly: `WalletSelectionModal` renders the connecting spinner inside its own
  modal and closes with the spinner still mounted, so the two unmount together
  and the inner one releases last. It was reported against Deploy Site because
  that is where the content first grows past the viewport, but the lock leaked
  at connect time and affected every page. The lock is now reference-counted in
  one place and is independent of release order. The Browse settings flyout had
  a second, independent copy of the same bug and now shares the lock.

- **The assign-domain modal told you that you owned no names when it had never
  checked.** `useOwnedArNSNames` returns an empty list without an error or a
  loading state when there is no ArNS address, so a user with no Solana wallet
  linked saw "No names yet — register an ArNS name right here in the console"
  sitting directly above the modal's own "Link a Solana wallet" banner. The
  prominent message was the wrong one, and it pointed people at buying a name
  they may already have owned. The empty state now names the real blocker when
  no wallet is linked, and Refresh is hidden there because without an address it
  can only return an empty list again. A failed lookup is now distinguished
  too — `fetchError` was tracked but never rendered, so a request that threw
  showed the same "No names yet" message; it now says so and offers a retry.
  Applies to all seven surfaces that use the modal.

## [4.2.0] - 2026-08-14

**Manage a name like a zone file, and pay from the wallet you actually
connected.** Everything below landed after 4.1.0 shipped. It is a minor rather
than a patch release because domain records and the portfolio view both gained
real capability, and because 4.1.0 was already deployed — leaving these commits
under the same version number would have made two materially different builds
indistinguishable in a bug report.

### Added
- **Records table** — the root `@` and every undername in one editable,
  DNS-style table on the name detail page, with search and pagination. Editing
  expands in place. Replaces a split where the root lived in "Edit details" and
  everything else in an "Undernames" modal, even though both edited the same
  record shape through the same editor.
- **Search your own names**, with a status on every row (permanent, active,
  expiring, expired). CSV export follows the filter rather than dumping the
  whole portfolio.
- **A path to buying a name from the picker** — the "get a name" prompt used to
  appear only when you owned none, so the moment you had one it vanished. The
  register link now carries what you are already naming via `?q=`.

### Fixed
- **Payments could be signed by a wallet you never connected.** Privy was
  configured to mint an embedded wallet for *all* users, and the payment paths
  preferred it whenever one existed. The checkout showed your connected wallet's
  balance while an empty embedded wallet signed the transfer, failing with an
  opaque `CALL_EXCEPTION`. Embedded wallets are now created only for users who
  arrive without one, wallet selection requires a match with the session
  address, and the signer is verified against the quoted address before spending.
- **Every record write without a logo failed.** A blank logo was sent as `''`,
  which the ANT program rejects (`InvalidLogo`), after `SetRecord` had already
  landed — so the target saved and the metadata did not.
- **Auto-reconnect could silently repoint your linked Solana wallet** to a
  different account, changing which names the console showed as yours.
- **Removing an undername** with no Solana signer errored instead of offering to
  connect.
- **Back from a name** returned to the public browse list instead of My Domains.
- **Focus rings on search fields** outlined the inner input rather than the
  field, and could be claimed by a button inside it.
- The expanded record editor had square corners; the name detail page was too
  narrow to show its records above the fold.

### Removed
- **USDC on Polygon** is no longer offered. The payment path was never finished.
  Existing pending-transaction recovery still lists it, so nobody with an
  in-flight transfer is stranded.

## [4.1.0] - 2026-08-12

**On brand, and keyboard-complete.** The console now tracks the ar.io brand kit
(2026-08-07) rather than an older snapshot of it: real Besley 800 headings, the
extended surface palette, and a homepage that alternates full-width section bands
instead of floating everything on a page-wide gradient. Alongside that, every
modal in the app gained the keyboard behaviour it was missing.

### Added
- **Extended brand palette** — Deep Dark (`#0e0a1c`), Dark Accent Lavender
  (`#D4C6FF`), Lavender Wash (`#f1ecff`), Warm Neutral (`#F6F4EF`) and Subtle
  Border (`#E6E4EF`) are now tokens, alongside a `max-w-site` (1400px) rail and
  the brand radii scale (`rounded-panel`, `rounded-hero`).
- **Global focus indicator** — a `:focus-visible` outline (2px primary, 2px
  offset) applied once in `globals.css`. It's an outline rather than a
  box-shadow, so it follows border-radius. On dark surfaces the `on-dark` class
  switches it to accent lavender, which primary can't match for contrast there.
- **Escape closes any modal**, plus a Tab focus trap, `role="dialog"`,
  `aria-modal`, body scroll lock and focus restore — all added once in
  `BaseModal` and inherited by ~20 modals. Nested modals are handled via a modal
  stack, so one Escape closes only the topmost.
- **`dismissible` prop on `BaseModal`** for modals that must not be cancelled
  mid-operation, such as the wallet-connection spinner.
- **Full-bleed section bands** on the homepage: the ArNS spotlight, pricing,
  Builder's Journey and the AI-agents section are now section backgrounds rather
  than cards, alternating so no two adjacent bands share a colour.
- **A closing call to action** anchoring the homepage.

### Changed
- **Headings render at Besley 800**, applied globally to `h1`–`h6`. Previously a
  `font-bold` utility was silently downgrading them to 700 in 143 places.
- **Homepage hero** is the brand's framed dark treatment, with the clouds
  composited into it rather than replaced.
- **Page background is white.** The viewport-fixed white→lavender gradient is
  gone; colour now comes from section bands. Because the old gradient was
  anchored to the viewport rather than the document, every card and band had a
  backdrop that shifted while scrolling — which is also why the footer had no
  visible edge against it.
- **Pricing reads as rules, not boxes** — border-divided rows instead of a
  three-card grid. The figures are unchanged and still live-bound.
- **Card radius is 20px** (was 16px), matching the kit's 20–24px range.
- **Every animation respects `prefers-reduced-motion`** via a global guard.
- **Status colours documented as tokens.** `docs/STYLE_GUIDE.md` previously
  instructed developers to write `text-green-600` and friends, which bypassed the
  `--color-success`/`error`/`warning`/`info` tokens entirely.

### Fixed
- **Five modals had no visible close button** — including the Upload, Deploy and
  Capture confirmations — because `showCloseButton` defaulted to `false`. It now
  defaults to `true`.
- **Modal content taller than 90vh was clipped and unreachable**; the panel now
  scrolls.
- **Labels in the card-checkout form pointed at nothing.** `FormEntry` renders
  `htmlFor={name}` but its inputs never set a matching `id`, so the association
  dangled on every field. Same fix applied across the gateway settings panel.
- **Close buttons announced as just "button"** — five icon-only buttons had no
  accessible name.
- **Three Discord icons were fetched from `ar.io/icons` at runtime.** On a
  permanent deploy that's a live dependency that can break long after publish;
  all are now inlined. Brand assets also now resolve through `BASE_URL`.
- **Code blocks in gateway settings** used `bg-black` and a hardcoded gray
  instead of the existing `--color-code-surface` token.

### Removed
- **The gift/redeem feature tree** — 7 unreachable components plus
  `getGiftPaymentIntent`. Both routes had been commented out since gifting was
  deprecated, leaving ~1,300 lines that rendered nowhere.

## [4.0.0] - 2026-08-06

**ArNS goes native.** The whole domain lifecycle — search, register, manage,
browse, and auctions — now lives inside the console, right next to your uploads,
deploys, and Pages. Register a name and point it at a site without ever leaving
the app, and pay however you like: Turbo Credits, your ARIO (liquid or staked),
or a card.

### Added
- **Native ArNS registration** — search, price, and buy dot-anything names
  without leaving the console. Prices are shown *before* you select; when a name
  is taken, the suggested alternatives are priced too; and a lease-vs-permanent
  break-even hint tells you roughly how many years of leasing equal owning it.
- **Pay your way** — register and renew with Turbo Credits, your ARIO (liquid or
  staked), or a card, with on-demand (just-in-time) credit top-up right in the
  checkout, so you never have to pre-fund. A native ARIO payment rail spans the
  whole lifecycle, not just the first purchase.
- **The full lifecycle, in-console** — renew, upgrade a lease to permanent,
  transfer or reassign (with brick-risk warnings), edit records (Arweave/IPFS
  targets and metadata), manage undernames (nickname + description as first-class
  fields), manage controllers (owner-vs-controller roles surfaced and gated), set
  or remove your primary name, and release a permabuy name back into a
  returned-name auction.
- **Browse & search all names** (`/domains`) — a scannable table with an
  expiring-soon filter and registry-backed availability; click any name for
  details.
- **Returned-name auctions** (`/returned-names`) — the aftermarket, with a
  premium-decay chart on the buy modal so you can time a bid.
- **Dedicated Domain Manager** (`/my-domains`) — your whole portfolio in one
  place, with CSV export.
- **Unified Pricing page** (`/pricing`) — a storage calculator and a domain-name
  price table (USD/ARIO toggle) behind one mode selector.
- **Sync Ownership** — detects and reconciles out-of-band ANT transfers so a name
  you moved elsewhere stays accurate in the console.
- **Logo upload UX** — client-side compression, drag-and-drop, live preview, and
  row thumbnails.
- **Atomic buyRecord** — eliminates the orphaned-ANT window, so a purchase can't
  leave a half-registered name behind.
- **Homepage ArNS spotlight** — a live, randomized Pages-template hero, a
  capability explorer, and contextual docs links.

### Changed
- **Account is now billing-only** (wallet, credits, top-up history, sharing) —
  all domain management moved to the dedicated `/my-domains` page.
- **Flat domain routing** — `/domains` (browse), `/arns` (register),
  `/returned-names` (auctions); pricing unified at `/pricing` (the old
  `/calculator` and `/name-prices` now redirect).
- **"permanent web" → "permanent cloud"** across the app; register/renew copy
  de-jargoned; the domain price box says "no renewals" instead of "forever".
- **Full mobile-friendliness pass** across the domain UX.
- **Config-scoped ArNS caches** — a settings/network change now flows through
  every ArNS read instead of serving stale data.

### Fixed
- **Name prices no longer double-count the demand factor** — they were inflating
  well above the ArNS app on high-demand-factor networks.
- **SOL balance reads the console-config cluster, not mainnet** — a Testnet/devnet
  wallet now shows its real balance instead of a false 0 that blocked the buy.
- **Registered the `/returned-names` route** (previously a dead nav link).
- **Honest mid-flight purchase messaging** — no false "not charged" claims when
  the outcome is unknown.
- **Cached Solana RPC / ARIO / ANT clients** (bounded LRU) — fixes the
  `MaxListenersExceededWarning` under repeated reads.

### Performance
- Prefetch every lease term's price so switching the term is instant (no
  per-term RPC round-trip).
- Gate the ~700 KB ArNS registry index behind an active search.
- Defer the homepage hero preview to idle time to protect page-load performance.

## [3.0.0] - 2026-07-29

The big launch: **Pages**, a no-code builder for permanent link-in-bio pages, plus a
rebuilt account page centered on your wallet, credits, and names, and a domain-first
flow across Pages and Deploy.

### Added
- **Pages** — a no-code, permanent link-in-bio builder in the console. Pick from a
  library of self-contained templates, edit profile / links / theme with a live
  preview, and publish a fully self-contained HTML page to Arweave at your ArNS
  name. Load a page by its ArNS name on any device to keep editing; every
  re-publish is its own permanent version.
- **Testnet mode** (formerly "Development") with a faucet link — try uploads,
  deploys, and Pages without touching real funds.
- **Top-up history** on the account page: every credit purchase on your wallet —
  crypto and card — newest first, with block-explorer links for on-chain payments,
  copyable receipt ids for card, and the exact credits each one added. Opt-in and
  signature-scoped: it loads only when you sign, nothing goes on-chain, no fee.
- **Export top-up history to CSV** — one click; exact amounts (BigInt-precise for
  18-decimal tokens) for accounting.
- **ArNS domain-expiry warnings** — leased names nearing expiry (or already in
  grace) surface at the top of the account page with the days remaining and a
  renew link that deep-links the specific name; covers every owned name loaded,
  not just the ones shown.
- **Domains table** — your names render as a scannable table (name, registered,
  status, actions) with expiring names sorted to the top.
- **Wallet-identity card** — a dedicated card for the signed-in account (address,
  network, block-explorer link); the linked Solana wallet used for ArNS updates is
  folded into it.
- **Smarter "free" pricing** — before labeling an upload free, the console checks
  your wallet's actual remaining free-tier allowance (`getFreeStatus`) instead of
  guessing from file size.
- **Pages: social preview cards** — published pages ship an auto-generated OG image
  via a manifest deploy, so links unfurl with a preview. Adaptive editor controls
  show only the theme axes a given template honors.
- **Pages: guided first run** — a curated "Start here" template set (plus a
  start-blank tile) so first-timers aren't faced with the whole library at once,
  and a one-time, dismissible orientation banner that reframes a freshly-picked
  template ("this is the <name> design — add your details on the left and it fills
  in live").
- **Top Up deep-link support**: external apps (e.g. ArDrive Desktop) can open
  `/topup?destinationAddress=<arweaveAddr>&source=ardrive-desktop` (optionally
  `&amount=<usd>&token=<ar|eth|sol>`) to pre-seed the credit destination. A
  "Funding: …" badge shows where credits will be delivered, and both the fiat and
  crypto paths credit the seeded address; a missing or invalid `destinationAddress`
  falls back to the connected-wallet / manual-entry behavior.

### Changed
- **Account page redesigned** — one flat, tokenized card style throughout (no more
  mixed gradients); a wallet + balance hero at the top; top-up history full-width;
  credit sharing demoted to the bottom.
- **Internationalized ArNS names render decoded** — `xn--` punycode names now show
  as their real Unicode (emoji or non-ASCII names), in the account page and header.
- **Consistent wallet display** — the header profile dropdown and the account card
  show the same wallet identity, labeled by network (Arweave / Ethereum / Solana)
  from one shared helper.
- **Exact crypto amounts** in the top-up history and CSV — BigInt formatting
  replaces float coercion, so large 18-decimal amounts no longer lose precision.
- **Domain-first across Pages and Deploy** — pointing an ArNS name at your work is
  now framed as the natural next step (skip-friendly, with plain-language value
  props); the post-deploy "add a domain" prompt matches the pre-deploy nudge, and
  the shared name picker shows a register-a-name nudge when you don't own one yet.

### Fixed
- **Cancelling a deploy no longer makes the next deploy silently no-op** (a stale
  closure / shared-controller race).
- Deploy and free-tier integrity fixes, plus a batch of correctness, UX, and
  performance fixes across the console.
- Pages: the ArNS "Select name" dropdown is no longer clipped by its card; the
  OG-card free-tier guard is allowance-aware.

### Removed
- Dead x402-protocol upload hook and other unused code paths.

## [2.2.1] - 2026-07-16

### Changed
- Manual transaction recovery on the top-up page; the gifting flow was deprecated
  in favor of it.
- New Turbo pricing model support (free tier + per-data-item fee).

## [1.2.3] - 2026-05-05

### Changed
- Update Solana migration snapshot date to June 1, 2026

## [1.2.2] - 2026-04-28

### Added
- Solana migration announcement banner with link to migration details

### Changed
- Banner component uses semibold font weight for prominent variant

## [1.2.1] - 2026-04-13

### Fixed
- Use production verify URL for development mode
- Verify page UI overhaul — provenance chain, hero section, evidence cards
- Patch @ar.io/sdk circular barrel imports causing TDZ crash
- Split @ar.io/sdk into separate chunk to fix TDZ crash

### Added
- Verification Service URL to settings page

## [1.2.0] - 2026-04-09

### Added
- Verify Data tool — transaction authenticity and provenance verification
- Gateway attestation display in verify results
- File comparison (local hash vs on-chain hash)
- Deep-link sharing for verify results (`?tx=<txId>`)

### Fixed
- Verify UI polish — certificate button, input validation, image preview, drag state
- Timer leak, timeouts, shared utils, accessibility fixes
- Break circular dependency between hooks for production build

## [1.1.0] - 2026-02-20

### Added
- Browse Data feature with service worker verification (Wayfinder integration)
- Cache hit display in verification details
- Service worker reliability improvements and retry logic
- Clear button for recent balance searches
- External nav links and updated branding
- Announcement banner component with dismiss tracking
- Builder's Journey section on landing page
- Configuration page merged into Service Settings
- `/login` route for external sign-in links

### Fixed
- Lazy-load BrowsePage to isolate wayfinder dependencies
- Resolve circular dependency and iframe blocking issues
- Browse iframe content display, downloads, and security hardening
- Arweave price endpoint fallback
- Pricing API retry with backoff
- ar.io Premium calculation formula

### Changed
- Full rebrand from Turbo App to ar.io Console
- Landing page reorganization and conversion flow improvements
- Social preview URLs updated to console.ar.io

## [1.0.0] - 2026-01-28 (v0.10.0)

### Added
- Try It Out page with Privy email login
- Light/dark theme support
- Light mode theming with WCAG AA accessible colors
- Image previews in upload panels

### Fixed
- Auto-switch network for Privy/EVM wallets in balance fetching
- Theme-aware header/footer backgrounds
- Light mode visibility for payment icons, drop zones, and My Domains

## [0.9.0] - 2025-12-16

### Added
- Smart Deploy with SHA-256 file deduplication
- App Name/Version tags for site deployments
- Base ARIO token support for crypto payments
- RainbowKit support for expanded Ethereum wallet connectivity

### Changed
- Migrate x402 to native SDK support with unified Ethereum signer
- Upgrade turbo-sdk to v1.39.2 (stable)
- Switch file hashes to base64url encoding
- Optimize build for smaller Arweave deploys

### Fixed
- Ethereum provider handling with wagmi connector
- Cached Ethereum signer reuse for ArNS operations
- RainbowKit auto-reconnect to different address

## [0.7.2] - 2025-11-04

### Added
- TTL preservation and configuration for ArNS records
- USDC support (ETH, Base, Polygon) with direct wallet payments
- Cryptocurrency pricing in storage calculator
- Cross-wallet top-up functionality
- POL (Polygon) payment support

### Changed
- Replace gatewayUrl with arioGatewayUrl config

## [0.5.0] - 2025-10-17

### Added
- Turbo Capture for webpage screenshot archival
- Custom tags for captures
- Undername UX improvements
- Dynamic APP_VERSION from package.json

### Fixed
- Dev mode testnet chain IDs and RPC URLs
- Upload folder tags

## [0.4.5] - 2025-10-10

### Added
- Plausible analytics and referrer policy
- Social media meta tags with splash image
- Storage capacity estimate in profile dropdown

### Fixed
- Solana wallet adapters (use window.solana directly)
- Drag & drop upload issues

## [0.4.0] - 2025-10-07

### Added
- JIT (Just-In-Time) payment support for uploads and deploys
- X402 BASE-USDC payment protocol support
- x402-only mode for bundlers without payment service
- Automatic network switching for X402 uploads
- Free upload limit detection from bundler
- Crypto balance validation for JIT payments
- Dynamic free upload limit display

### Fixed
- Large file upload issues and UI improvements
- Upload cancellation support with smoother progress display

## [0.3.0] - 2025-09-26

### Added
- Privy email authentication with embedded wallets
- Solana payment support
- Account page with balance, upload history, and deploy history
- ArNS domain assignment for site deploys
- Credit sharing and revocation

### Changed
- Theme and styling updates
- Improved ETH wallet support
