# Changelog

All notable changes to the ar.io Console are documented in this file.

## [4.0.0] - 2026-07-28

The account page is rebuilt around what you came for — your wallet, your credits,
and your names — with your full top-up history, ArNS expiry warnings, and a free
tier that reflects your real allowance.

### Added
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
- **Connected-wallet display unified** between the header profile dropdown and the
  account page: consistent label, address format, and a single unlink icon.
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

## [3.0.0] - 2026-07-21

### Added
- **Pages** — a no-code, permanent link-in-bio builder in the console. Pick from a
  library of self-contained templates, edit profile / links / theme with a live
  preview, and publish a fully self-contained HTML page to Arweave at your ArNS
  name. Load a page by its ArNS name on any device to keep editing; every
  re-publish is its own permanent version.
- **Testnet mode** (formerly "Development") with a faucet link — try uploads,
  deploys, and Pages without touching real funds.

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
