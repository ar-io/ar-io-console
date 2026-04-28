# Changelog

All notable changes to the ar.io Console are documented in this file.

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
