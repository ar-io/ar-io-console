# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run lint         # ESLint validation
npm run type-check   # TypeScript checking (strict mode)
npm run build        # Build with type check (4GB memory)
npm run build:prod   # Production build with type check (8GB vite, no sourcemaps)
npm run build:staging # Staging build with type check + source maps (8GB vite)
npm run clean        # Remove dist and caches
npm run clean:all    # Full clean and reinstall
npm run preview      # Preview production build
```

**Notes:**
- Uses yarn (packageManager: yarn@1.22.22) but npm works
- Memory allocation via `cross-env NODE_OPTIONS=--max-old-space-size` (4GB dev/build, 8GB prod/staging vite build)
- `prebuild` lifecycle hook runs `tsc -b` before every `npm run build`; `build:prod`/`build:staging` call it explicitly
- Tests: Vitest — `npm test` (run once) / `npm run test:watch`. `vitest.config.ts` is separate from `vite.config.ts`; it uses the `node` environment (no DOM/component harness) and only picks up `src/**/*.test.ts`. Coverage is **pure logic only** — there is no component/DOM harness, so anything importing React or a wallet SDK is untestable as-is. ~58 suites, the bulk in three clusters: `src/features/arns/` (30+ — ANT roles, record-writer selection, price tables, and the whole `purchase/` state machine: `cardPlan`, `buyDecisions`, `settlementRoute`, `purchaseMachine`, `pollPurchase`), `src/features/pages/` (18 — schema, render, publish, plus `templates/security.test.ts`/`robustness.test.ts`/`registry.test.ts` which auto-run over every template), and `src/utils/` (13 — deep links, punycode, explorer URLs, free tier, unit formatting, domain CSV/expiry/sort, wallet tokens, Solana session restore). One stray outside them: `src/components/modals/bodyScrollLock.test.ts`. Run a single file: `npx vitest run src/utils/topupDeepLink.test.ts`
- Path alias: `@/` maps to `src/` (e.g., `import { useStore } from '@/store/useStore'`)
- Vite `base: '/'` — absolute asset paths, required so nested routes (`/domains/:name`) resolve assets on direct navigation. This trades away Arweave *subpath* compatibility (the old `'./'` value): the build assumes it is served from a domain root (`console.ar.io`, or an ArNS name root), not from `gateway/<txid>/`. Don't flip it back without re-checking nested-route deep links.
- Build-time defines: `import.meta.env.PACKAGE_VERSION` (from package.json) and `import.meta.env.BUILD_TIME` (date-only ISO string)
- Route pages are lazy-loaded (`React.lazy`); Layout wraps `<Outlet>` in `<Suspense>` so the header/nav stay mounted while page chunks load. **Exception:** `LandingPage` is eagerly imported — it's the primary entry point, so lazy-loading it just produces a spinner flash on every first visit
- `vite-plugin-fix-modules.ts` (repo root) is a local Vite plugin that aliases `pino` → `pino/browser.js` and `@walletconnect/environment` to its ESM build. Wallet-SDK transitive deps that ship Node-only entry points go here, not in the polyfill list
- `scripts/arns-buy-smoke.mjs` is a **devnet-only** smoke script (not shipped, not in CI) that drives the same turbo-sdk calls `TurboArNSClient` makes against a local bundler: `PAYMENT_URL`/`UPLOAD_URL` env vars, `node scripts/arns-buy-smoke.mjs`
- `vite-plugin-pwa` (`VitePWA` in `vite.config.ts`) is configured in `injectManifest` mode purely to compile the Browse service worker (`src/features/browse/service-worker/service-worker.ts`) — `manifest: false`, no offline app caching. It is the build mechanism for the Browse verification SW, not a general PWA setup.

## Critical Gotchas

Before diving in, these are the most common issues:

1. **Pricing hooks return strings**: `useWincForOneGiB()` returns `string | undefined`, not number:
   ```typescript
   const wincForOneGiB = useWincForOneGiB();
   const wincNum = wincForOneGiB ? Number(wincForOneGiB) : NaN;
   if (Number.isFinite(wincNum) && wincNum > 0) { /* safe */ }
   ```

2. **Clear signer cache on wallet switch**: Call `clearEthereumTurboClientCache()` when user disconnects or switches wallets.

3. **Network switching is automatic**: `useEthereumTurboClient` automatically switches EVM wallets to the correct network before creating signers.

4. **Balance refresh after payments**: Dispatch `window.dispatchEvent(new CustomEvent('refresh-balance'))` after any payment.

5. **JSX brace escaping**: For API endpoint display: `<code>/endpoint/{"{txId}"}</code>`

6. **destinationAddress required**: All pricing API calls need `destinationAddress`. Use `address || 'pricing-lookup'` as fallback.

7. **TypeScript strict mode**: The codebase uses `strict: true`. Handle nullable types explicitly; avoid `!` assertions unless certain.

8. **Async wallet operations may fail**: Always wrap `createEthereumTurboClient()`, `fundAndUpload()`, and similar async wallet operations in try/catch blocks with user-friendly error handling.

9. **Per-data-item fee in cost math**: Turbo's newer pricing adds a fixed per-item fee on top of storage. Every cost calculation (Upload, Deploy, Capture) must add `Number(usePerDataItemFee())` in winc **per billable data item** — folder uploads incur it per file. The hook returns `string | undefined`; guard before adding.

10. **Free tier has two axes**: `useFreeUploadLimit()` returns `{ freeUploadLimitBytes, freeTier }`. `freeUploadLimitBytes` (== `freeTier.maxItemBytes`) is the per-item size cap used by `isFileFree()`. `freeTier.lifetimeBytes` / `freeTier.ipBytes` are separate lifetime/IP quotas (0 = uncapped) shown in UI messaging — don't conflate them with the per-item limit.

## Architecture Overview

### Application Structure
ar.io Console - a unified application for uploading and accessing permanent data through the ar.io Network:
- **File uploads**: Drag & drop with instant confirmation
- **Site deployment**: Deploy static sites with ArNS domain support
- **Credit management**: Purchase, share, and gift credits
- **ArNS domains**: Search and manage domain names
- **Browse**: View permaweb content with optional cryptographic verification via Wayfinder

### Key Directories
```text
src/
├── components/
│   ├── panels/           # Feature panels (TopUpPanel, UploadPanel, DeploySitePanel, etc.)
│   ├── panels/fiat/      # Fiat payment flow (3-panel: Details→Confirm→Success)
│   ├── panels/crypto/    # Crypto payment panels
│   ├── modals/           # BaseModal, WalletSelectionModal, ReceiptModal
│   └── account/          # Account page components
├── features/
│   ├── browse/           # Browse feature with Wayfinder verification (see below)
│   └── pages/            # Pages — permaweb link-in-bio builder (see below)
├── hooks/                # Custom React hooks (Turbo SDK wrappers, pricing, uploads)
├── pages/                # React Router page components
├── services/             # Backend service clients (paymentService, etc.)
├── store/useStore.ts     # Zustand state management
├── providers/            # WalletProviders.tsx (Wagmi, Solana, Privy, Stripe, React Query)
├── utils/                # Helpers (addressValidation, token utilities, jitPayment)
├── lib/                  # API clients (turboCaptureClient.ts)
├── workers/              # hashWorker.ts — Smart Deploy content hashing (via utils/fileHash.ts)
├── config/               # banner.ts — site-wide announcement banner
├── types/                # global.d.ts (window.arweaveWallet etc.) + shared types
└── constants.ts          # App config, token definitions, X402_CONFIG
```

### Browse Feature (Wayfinder Integration)

The Browse feature allows users to view permaweb content with optional cryptographic verification.

**Key files:**
- `src/features/browse/components/BrowsePanel.tsx` - Main browse UI
- `src/features/browse/components/BrowseSearchBar.tsx` - ArNS/TX ID input
- `src/features/browse/service-worker/service-worker.ts` - SW for content interception
- `src/features/browse/service-worker/wayfinder-instance.ts` - Wayfinder SDK integration

**How it works:**
1. User enters ArNS name or transaction ID
2. Service worker intercepts requests and routes through ar.io gateways
3. When verification is enabled, Wayfinder validates content signatures
4. Content displayed in iframe with verification badge

**Dependencies:** `@ar.io/wayfinder-core`, `@ar.io/wayfinder-react`

Browse is now the *only* verification surface. A separate `/verify` page existed
until 4.4.0, backed by an unmaintained third-party service (`verifyApiUrl`); it
was removed rather than kept limping, with the intent that Browse grows to cover
what it did. Don't reintroduce a second verification entry point.

### Wallet Integration

**Three wallet ecosystems:**

| Wallet | Signer | Notes |
|--------|--------|-------|
| Arweave (Wander) | `ArconnectSigner` via `window.arweaveWallet` | Uploads and payments only |
| Ethereum (all) | `InjectedEthereumSigner` from `@ar.io/sdk/web` | Supports MetaMask, RainbowKit, WalletConnect, Coinbase |
| Solana (Phantom/Solflare/Privy) | Wallet adapter via `useWallet()` | Required for ArNS updates; auto-detected via Standard Wallet API |

**`WalletProvider` is passed `wallets={[]}` on purpose** (`solanaWallets: never[]` in `WalletProviders.tsx`). Every Solana wallet arrives through the Wallet Standard registry, never through a hardcoded adapter list — so adding a wallet means it registering itself, not editing that array.

**Email Auth (Privy):** Creates an embedded **Ethereum *and* Solana** wallet via `@privy-io/react-auth`. Privy builds a real Wallet Standard Solana wallet but never calls `registerWallet`, so the adapter cannot see it; `providers/PrivySolanaBridge.tsx` registers it (idempotently, unregistering on unmount) **only while `authenticated`** — registering unconditionally would offer a Privy wallet to Wander/Phantom users who cannot connect it. Net effect: Phantom, Solflare and Privy all come through one `useWallet()`, so `useArNSTurboSigner` and the linked-wallet flow need no Privy branch, and an email user can sign ArNS writes without installing anything. The Solana wallet was **added, not swapped** — Turbo credits belong to an address, so changing an existing email user's identity would strand their balance.

**Ethereum Signer Caching:** The `useEthereumTurboClient` hook caches signers globally so users only sign once per session. Call `clearEthereumTurboClientCache()` when switching wallets.

**Network Switching:** For EVM token transfers (base-ario, base-eth, base-usdc, etc.), the hook automatically switches the wallet to the correct network BEFORE creating the signer. This is critical for Privy embedded wallets.

### State Management (Zustand)

**Persistent state** (localStorage via `partialize`):
- `address`, `walletType`, `arnsNamesCache`, `ownedArnsCache`
- `uploadHistory`, `deployHistory`, `uploadStatusCache`
- `configMode`, `customConfig`, `x402OnlyMode`
- JIT payment preferences (`jitPaymentEnabled`, `jitMaxTokenAmount`, `jitBufferMultiplier`)
- Smart Deploy (`smartDeployEnabled`, `fileHashCache`) - deduplication via content hashing

**Ephemeral state:**
- `creditBalance`, payment flow state, UI state

**Cache expiry:** ArNS names (24h), owned names (6h), upload status (1h confirmed, 24h finalized)

### Pages Feature

Pages (`/pages`) is a no-code link-in-bio builder: users pick a template, edit profile/blocks/theme with a live preview, and publish a permanent, self-contained HTML page to Arweave with an optional ArNS domain. Pure-logic modules are node-tested (see the Vitest note in Quick Start).

**Key files:**
- `src/features/pages/schema.ts` - `PageDef` (source of truth) + `validatePageDef`
- `src/features/pages/render/renderPageHtml.ts` - assembles the final HTML around the chosen template's output; injects a base `overflow-wrap:break-word` safety net so long content can't overflow
- `src/features/pages/templates/` - 32 self-contained template modules + `index.ts` registry; `shared.ts` holds the escape/sanitize helpers
- `src/features/pages/hooks/usePagePublish.ts` - publish orchestration (render → upload → manifest → ArNS)
- `src/features/pages/components/PagesPanel.tsx` + `components/controls/` - editor UI

**Template contract** (enforced by `templates/security.test.ts` + `robustness.test.ts` + `registry.test.ts`, which auto-run over every template): each template is `{ id, meta, seed, render(def,ctx) }`, pure + deterministic (no `Date`/`Math.random`), CSS scoped under `.pg-<id>`. Hard rules: escape ALL user content (`escapeHtml`/`escapeAttr`), sanitize theme values (`cssColor`/`cssFontFamily`/`hexToRgba`), 100% self-contained (**no external assets and NO `url(` at all**), render every block type, never throw.

**Publish = manifest deploy:** a page ships as an `arweave/paths` v0.2.0 manifest bundling `index.html` + an auto-generated `social.png` OG card (`render/ogCard.ts` → `publish/rasterizeOgCard.ts` → `publish/manifest.ts`). ArNS points at the manifest tx, so the page is `name.ar.io/` and its preview is the future-proof manifest path `name.ar.io/social.png` (baked as `og:image`). The OG card + manifest are best-effort and zero-cost (only uploaded when they fit the free tier and not in x402-only mode); with no card it deploys the bare `index.html` tx. `meta.ogImage` is set only on the render copy, never the hashed source def, so dedup is unaffected.

**Adaptive editor controls:** `render/themeSupport.ts` empirically probes which theme axes a template honors (render seed vs. poisoned-axis, diff the island-stripped output) and whether it renders link emoji icons; `ThemeControls`/`BlocksControls` show only live controls, no dead sliders. Results cache per template id and auto-appear if a template later gains support for an axis.

### ArNS Feature (`src/features/arns/`)

The largest feature in the repo (~110 files) and the least guessable — read this before touching anything under `/domains`, `/arns`, `/returned-names`, or `/my-domains`.

**ArNS runs on Solana.** A name resolves to an **ANT**, which is a Solana Metaplex Core asset — not an AO process. Every ArNS *write* therefore needs a Solana signer, regardless of the user's session wallet — but since Turbo sponsors the fees, that wallet needs **no SOL balance**. Email sign-in creates one (see `PrivySolanaBridge`), so a user who has never held cryptocurrency can own and run a name.

**Turbo sponsors the Solana fees** (`actions/`). Twelve actions are gas-sponsored (nine at launch; `set-record-metadata`, `remove-record-metadata` and `transfer-record` arrived in turbo-sdk `1.42.0-alpha.11`):
Turbo is fee payer, the user pays in Turbo Credits, and the ANT is minted
straight to the buyer. **Turbo takes custody of nothing** — there is no claim
step, no transfer-out, and no "Turbo-held name". Don't build one, and don't
imply one in copy. The custody tree that predated this (`custodyStrategy`,
`nameCustody`, `mergeCustodialNames`, `ClaimToContinueModal`,
`CustodialNamePanel`) is **deleted**, not disabled.

turbo-sdk owns the protocol — the two response shapes, the nonce discipline and
the `x-owner-*` proof — via `buyArNSName`, `setArNSRecord` and friends. **Never
hand-roll the HTTP.** What console owns is the half the SDK cannot: the browser
wallet that signs (`actions/browserOwnerSigner.ts`, which implements the SDK's
`ArNSOwnerSigner` against a Wallet Standard adapter) and honest copy about what
is sponsored (`actions/sponsorship.ts`).

**Pin turbo-sdk EXACTLY.** Stable `1.42.0` sorts *above* the `1.42.0-alpha.x` line in
semver and contains **no ArNS surface at all**, so a caret range or a routine
`npm update` silently deletes this feature and nothing fails until someone tries
to buy a name.

**Every action costs credits, and the SDK says otherwise.** The eight
non-purchase actions were free at launch and now carry a small margin
(ar-io-bundler#303). The published SDK's doc comments still call them "free" —
stale, and believing them puts a promise of no charge in front of a real one.

Prices come from `GET /v1/arns/actions/:action/price` (`useArNSActionPrice`),
NOT from `/v1/arns/price/:intent/:name`, which serves only the four purchase
intents. **Fetch, never hardcode:** the figures differ per environment — a
record write is 0.1699 credits on testnet and 0.1714 on production, and
removing a record is 0 on testnet but 0.05 on production. A baked-in number is
right in development and wrong in front of users. An unloaded price must
degrade to "a small amount", never to "free".

`TurboArNSClient.getArNSActionPrice` is a hand-rolled unauthenticated GET only
because the SDK's `getArNSActionPrice` (turbo-sdk#463) is merged but unreleased
— swap to it when the alpha lands.

**Sponsorship is not universal, and the exceptions are the whole UX problem.**
Not sponsored, each still costing the user SOL:
- **Returned-name auctions** (`useBuyReturnedName`) — ARIO-funded, needs a
  client-spawned ANT (`services/antSpawn.ts`, which survives for this path
  alone, ~0.02 SOL) and is the only flow with **two** wallet approvals.
- **Paying with ARIO** — not a page but an option in the payment picker,
  wearing a "Best price" badge. It is the user's own `buyRecord`, not a Turbo
  action, so their wallet pays the rent. `paymentOptions.ts` applies the SOL
  block to the ARIO option *alone*; applying it broadly blocks exactly the
  zero-SOL buyers sponsorship exists for.
- Primary name, release, reassign, and **ANT-level** metadata
  (`EditDetailsModal`). Record-level metadata IS sponsored
  (`set-record-metadata`) and the two sit next to each other in the program:
  editing a record's display name is free, editing the name's own is not.
  Label them distinctly or users meet the difference at a wallet prompt.

**A record save can cost TWO approvals.** `setArNSRecord` (target + TTL) and
`setArNSRecordMetadata` (display name, logo, description, keywords) are
separate actions, so changing both prompts twice. `toRecordChange` diffs
against the loaded record precisely so metadata is sent only when it actually
changed — a snapshot would make every save a two-prompt save. The
controller path has the opposite shape: the ANT program bundles record and
metadata into one transaction, so a self-signed save is always one signature.

**Turbo cannot change a name on its own.** Buying grants Turbo controller
rights in the same transaction that mints the name, but `setArNSRecord` takes
an `ArNSOwnerSigner` **unconditionally** and the service verifies that proof
against the **current on-chain owner**. So every record write carries the
owner's own action-bound, single-use signature. The grant only decides what the
owner approves: a cheap offline message while it stands, a full transaction once
revoked. Copy must say what the grant is *for* (Turbo paying the fee), never
what it lets Turbo do — which is nothing alone.

**A controller is not sponsored** (`records/writerChoice.ts`). Because the proof
must come from the owner, a controller's signature is rejected. They keep the
capability and pay their own fee, so record writes fork by role: owner →
`records/sponsoredWriter.ts`, controller → `records/antWriter.ts`. `unknown`
**blocks** rather than guessing — guessing sponsored for a controller burns a
wallet prompt on a request that 401s, guessing self-signed for an owner charges
a fee they don't owe. This matters far beyond the records table: "your names" is
Owned ∪ Controlled, so controlled names flow into Deploy Site, Capture, Assign
Domain and Pages publish through `useOwnedArNSNames.updateArNSRecord`.

**Metadata fields are tri-state** (`recordFields.ts`). Omitted leaves a field
unchanged, `null` clears it, a value sets it — and they are bound *distinctly*
in the owner proof, so "clear" and "set to empty string" are different
authorizations. **Never normalise `null` to `''`.** `toRecordChange` therefore
diffs against the record as loaded rather than sending a snapshot;
`withoutClears` drops the nulls for the ANT-direct path, which has no way to
express a clear, and is what gets deleted when those actions land.

**Linked Solana wallet** (`hooks/useLinkedSolanaWallet.ts`): Arweave/Ethereum users link a **secondary** Solana wallet for ArNS without changing their primary session identity. `linkedSolanaAddress` + `linkedSolanaWalletName` persist in the store, and `getArNSAddress()` returns the primary address for Solana sessions or the linked address otherwise. Read-only lookups work from the persisted address alone; **writes need a live signer**, so the hook auto-reconnects the named adapter on page load (the Solana `WalletProvider` runs `autoConnect=false`). `hooks/useArNSTurboSigner.ts` turns that into the two things writes need: a `walletAdapter` for `TurboFactory.authenticated` and a `@solana/kit` `SolanaSigner` for `ANT.spawn`.

**Purchases are resumable and must not be repeated** (`services/arnsPurchaseResume.ts`): **credits are debited when the action is CREATED**, not when it is signed, so an abandoned wallet prompt has already been charged (Turbo refunds it on TTL expiry). The nonce is persisted via the SDK's `onNonce`, which fires *before* the wallet opens — that is the only route back to a paid-for purchase if the page reloads mid-approval. Resuming by nonce is a pure read (`GET /v1/arns/actions/:nonce`) and can never double-debit; **re-creating an action always can.** `processId` persistence now serves the auction path only, where a client spawn still happens and a retry must reuse it rather than bleed another ~0.02 SOL.

**Owner vs. controller gating** (`antRole.ts`): `getArNSRecordsForAddress` returns `Owned ∪ Controlled`, so a name in "your names" may be one the wallet only *controls*. Controllers can edit records/metadata/undernames; **transfer, reassign, release, and controller changes are owner-only**. Use `deriveAntRole` (optimistic — `unknown` treated leniently) only on owned-name surfaces where every row is in the ACL; use `deriveAntRoleStrict` (`none` is a real answer) anywhere a name isn't guaranteed to be the wallet's, such as the public Name Detail page. `isOwnerOnlyAllowed` denies both `unknown` and `controller` so destructive actions never flash before ownership is confirmed.

**ACL drift** (`services/aclDrift.ts`): the on-chain ANT ACL is an eventually-consistent index powering "your names". A **raw Metaplex Core transfer** (direct send or NFT-marketplace sale) moves the asset but does *not* update the ACL, so a newly-owned name goes missing until `syncAcl` is called. Drift is detected by scanning MPL Core assets by owner and diffing against the ACL owner set.

**Service layer** (`services/TurboArNSClient.ts`): framework-agnostic (plain `fetch` + turbo-sdk), holds no React state, and takes **signers injected per call** rather than reading `window.solana`. Intents: `Buy-Name`, `Extend-Lease`, `Increase-Undername-Limit`, `Upgrade-Name`. `purchaseWithCredits` dispatches to the SDK's per-action methods; `Buy-Name` is the only one needing an `owner` signer, and the only one that opens a wallet.

`features/arns/index.ts` is the public surface — import from there, not via deep relative paths.

### Configuration System

Three modes via `configMode` in store (`ConfigMode = 'production' | 'development' | 'custom'`):
- **production**: Mainnet endpoints, production Stripe key
- **development**: Testnet/devnet endpoints, test Stripe key. Note: the store value is still `'development'`, but the UI labels it **"Testnet"** (Header shows `TESTNET MODE`, GatewayInfoPanel shows a testnet faucet link). Don't rename the enum expecting the label to follow.
- **custom**: User-defined for testing

Config includes: `paymentServiceUrl`, `uploadServiceUrl`, `captureServiceUrl`, `arioGatewayUrl`, `stripeKey`, `processId`, `tokenMap`, plus the four **Solana program IDs** the ArNS feature reads: `coreProgramId`, `garProgramId`, `arnsProgramId`, `antProgramId` (mainnet constants in production, `DEVNET_PROGRAM_IDS` in development). `processId` is the legacy AO field — it is empty on devnet and unused by the Solana ArNS paths.

Access via `useTurboConfig(tokenType)` hook or `getCurrentConfig()` from store.

## Token Support

**Supported tokens** (from `constants.ts`):
`arweave`, `ario`, `ethereum`, `base-eth`, `solana`, `kyve`, `pol`, `usdc`, `base-usdc`

**Withdrawn from selection** (`unavailableCryptoTokens` in `constants.ts`):
`base-ario` — turbo-sdk drops it as of 1.42.0-alpha.8, so a payment could be
started that the SDK cannot settle — and `polygon-usdc`. Both keep their types
and formatting tables so existing history still renders, and
`PendingTxRecoveryBanner` deliberately ignores the list so a user mid-transfer
on a retired network can still recover their funds. Retire a token by adding it
there, not by deleting it.

**Network detection:** `getTokenTypeFromChainId()` in `utils/index.ts`

**JIT payments supported:** `solana`, `base-eth`, `base-usdc` — the authority is `supportsJitPayment()` in `utils/jitPayment.ts`, which has never included `ario` or `base-ario` despite earlier docs saying so

**EVM token transfer types** (require network switching): `base-ario`, `base-eth`, `base-usdc`, `polygon-usdc`, `pol`, `usdc`

## Creating Turbo Clients

Different wallet types require different client instantiation:

```typescript
// Arweave wallet
import { TurboFactory, ArconnectSigner } from '@ardrive/turbo-sdk/web';
const signer = new ArconnectSigner(window.arweaveWallet);
const turbo = TurboFactory.authenticated({ signer, ...turboConfig });

// Ethereum wallet (PREFERRED: use the hook for automatic caching + network switching)
import { useEthereumTurboClient } from '../hooks/useEthereumTurboClient';
const { createEthereumTurboClient } = useEthereumTurboClient();
const turbo = await createEthereumTurboClient('base-ario'); // or 'base-eth', 'base-usdc', etc.

// Solana wallet (uses wallet adapter — works with Phantom, Solflare, or any Standard Wallet API wallet)
import { TurboFactory } from '@ardrive/turbo-sdk/web';
import { useWallet } from '@solana/wallet-adapter-react';
const { publicKey, signMessage, signTransaction } = useWallet();
const turbo = TurboFactory.authenticated({
  token: 'solana',
  walletAdapter: { publicKey, signMessage: signMessage!, signTransaction: signTransaction! },
  ...turboConfig,
});

// Manual Ethereum client (for non-hook contexts - prefer the hook above)
import { InjectedEthereumSigner } from '@ar.io/sdk/web';
import { getConnectorClient } from 'wagmi/actions';
const connectorClient = await getConnectorClient(wagmiConfig, { connector: ethAccount.connector });
const ethersProvider = new ethers.BrowserProvider(connectorClient.transport, 'any');
const ethersSigner = await ethersProvider.getSigner();
const userAddress = await ethersSigner.getAddress();
// InjectedEthereumSigner expects a provider with getSigner() returning signMessage/getAddress
const injectedProvider = {
  getSigner: () => ({
    signMessage: async (msg: string) => ethersSigner.signMessage(msg),
    getAddress: async () => userAddress,
  }),
};
const injectedSigner = new InjectedEthereumSigner(injectedProvider as any);
await injectedSigner.setPublicKey(); // Requests signature
const turbo = TurboFactory.authenticated({ signer: injectedSigner, token: 'base-eth', ...turboConfig });
```

## Upload Tagging System

All uploads include standardized metadata tags:

**Deployment tool tags (always included):**
- `Deployed-By`: 'ar.io Console' (from `APP_NAME` constant) - identifies the deployment tool
- `Deployed-By-Version`: Dynamic from package.json - version of the deployment tool
- `App-Feature`: 'File Upload' | 'Deploy Site' | 'Capture'

**User app tags (optional, for site deployments):**
- `App-Name`: User-provided app/site name
- `App-Version`: User-provided app version

**Feature-specific:** `Content-Type`, `File-Name`, `File-Path`, `Original-URL`, `Title`, viewport dimensions

## Upload Workflow

The app supports three upload modes with different payment strategies:

**1. Pre-funded Credits (Traditional)**
- User buys credits via fiat or crypto first
- Upload deducts from credit balance
- Works with all wallet types

**2. JIT (Just-In-Time) Payments**
- No pre-purchase required; crypto sent at upload time
- Uses `fundAndUpload()` from Turbo SDK
- Supported tokens: `ario`, `base-ario`, `solana`, `base-eth`, `base-usdc`
- Configurable via store: `jitPaymentEnabled`, `jitMaxTokenAmount`, `jitBufferMultiplier`

**3. X402 Protocol (Base USDC)**
- Pay-per-upload via HTTP 402 payment flow
- Only works with Ethereum wallets on Base network
- Used when `x402OnlyMode` is enabled or connecting to x402-only bundlers

**Upload Flow Decision Tree:**
```
1. Check if file is free (under bundler's free limit)
   → Yes: Upload without payment
   → No: Continue to payment check

2. Check wallet type and mode
   → x402OnlyMode + Ethereum wallet: Use X402
   → JIT enabled + supported token: Use fundAndUpload
   → Has sufficient credits: Use standard upload
   → None: Prompt user to buy credits
```

## X402 Protocol (x402-only mode)

Enables uploads without pre-purchased credits via Base network USDC. Used when connecting to ar.io bundlers that only support x402.

**Key files:**
- `useX402Pricing.ts`: USDC cost calculation
- `useEthereumTurboClient.ts`: Creates authenticated Turbo client for Ethereum wallets

Note: the standalone x402-protocol upload hook (`useX402Upload`/`uploadFileWithX402`, SDK `X402Funding` mode) was never wired in and has been removed. In x402-only mode, billable base-usdc uploads run the JIT `topUpWithTokens` path in `useFileUpload`/`useFolderUpload`. `useX402Upload.ts` now only exports the no-op `clearX402SignerCache` used by wallet-switch cleanup.

**Config** (`X402_CONFIG` in constants.ts):
- Production: Base Mainnet (chainId 8453)
- Development: Base Sepolia (chainId 84532)

**x402OnlyMode:** When enabled (via Developer Resources panel), only `base-usdc` payments are available and only Ethereum wallets can make billable uploads/deploys.

## Network Configurations

Network-specific settings in `constants.ts`:

| Config | Production ChainId | Development ChainId | Token Contract |
|--------|-------------------|---------------------|----------------|
| `X402_CONFIG` | 8453 (Base) | 84532 (Base Sepolia) | USDC on Base |
| `BASE_ARIO_CONFIG` | 8453 (Base) | 84532 (Base Sepolia) | ARIO bridged to Base |
| `ETHEREUM_CONFIG` | 1 (Mainnet) | 11155111 (Sepolia) | USDC on Ethereum |
| `POLYGON_CONFIG` | 137 (Polygon) | 80002 (Amoy) | USDC on Polygon |

## Wallet Capability Matrix

| Feature | Arweave | Ethereum/Base/Polygon | Solana |
|---------|---------|----------------------|--------|
| Buy Credits (Fiat) | ✅ | ✅ | ✅ |
| Buy Credits (Crypto) | ✅ AR/ARIO | ✅ ETH/Base-ETH/Base-ARIO/POL/USDC | ✅ SOL |
| Upload/Deploy/Capture | ✅ | ✅ | ✅ |
| Share Credits | ✅ | ✅ | ✅ |
| Update ArNS Records | ❌ | ❌ | ✅ (no SOL needed) |
| JIT Payments | ❌ | ✅ Base-ETH, Base-USDC | ✅ SOL |
| X402 USDC Uploads | ❌ | ✅ (Base only) | ❌ |

The ArNS row is about the *session* wallet. Arweave/Ethereum users reach ArNS writes through a **linked** Solana wallet (`useLinkedSolanaWallet`), and email/Privy users through their embedded Solana wallet — in both cases the primary identity is unchanged. That wallet signs but never pays: Turbo is fee payer, so its SOL balance can stay at zero for the life of the name. The exceptions are listed under the ArNS feature above.

## Environment Variables

```bash
VITE_NODE_ENV=production        # Controls mainnet vs testnet
VITE_PRIVY_APP_ID=...           # Required for email auth
VITE_WALLETCONNECT_PROJECT_ID=...  # Optional
VITE_SOLANA_RPC=...             # Required for prod — full provider URL incl. token
VITE_ETHEREUM_RPC=...           # Optional — defaults to ethereum.publicnode.com
VITE_BASE_RPC=...               # Optional — defaults to mainnet.base.org
VITE_POLYGON_RPC=...            # Optional — defaults to polygon-bor-rpc.publicnode.com
```

**All RPC endpoints resolve through `RPC_ENDPOINTS` in `store/useStore.ts`**, which
both the `tokenMap` and wagmi's transports read, so balance reads and wallet
operations always hit the same provider per chain. Add a new chain there, not in
two places.

The three EVM vars are optional and each falls back to the public endpoint it
replaced. They exist because those defaults are free public RPCs that rate-limit
hard — `mainnet.base.org` alone backed three tokens plus the wallet connector,
and Base's docs say it is not for production. If the app is seeing 429s, check
these before assuming it is Solana.

**Two `rpcUrls` are deliberately left public** (`useTokenBalance.ts`,
`CryptoConfirmationPanel.tsx`): they are `wallet_addEthereumChain` params, so the
URL is kept by the *user's wallet* and polled independently forever. Pointing
those at a paid provider would put every user's MetaMask on our quota.

`VITE_SOLANA_RPC` is consumed by both `store/useStore.ts` (`tokenMap.solana`) and
`providers/WalletProviders.tsx` (`ConnectionProvider`) so the app uses one RPC
throughout. Never hardcode a provider URL with a token back into source — it ships
in the bundle and, on Arweave, stays retrievable permanently.

Service URLs managed by store's configuration system, overridable via Developer Resources panel.

## CI & Deployment

**`.github/workflows/ci.yml`** — runs on every PR and on pushes to `main`/`develop`: `npm ci --legacy-peer-deps` → `type-check` → `lint` → `test` → `build`. All four must pass, so run them locally before pushing.

**`.github/workflows/staging.yml`** — every push to `develop` publishes to GitHub Pages (`ar-io.github.io/ar-io-console`), running the full CI gate first. A Pages *project* site is served from `/<repo>/`, not a domain root, so the build sets `VITE_BASE_PATH` and the router reads the same value via `import.meta.env.BASE_URL` — the two cannot drift. `index.html` is copied to `404.html` so deep links reach the router instead of 404ing. The `github-pages` environment must list `develop` as an allowed deployment branch; it ships allowing `main` only.

**The flow is `feature → develop → main`.** `main` is protected: PR required, CI must pass, 0 approvals (a solo maintainer cannot approve their own PR), admin bypass on.

**`.github/workflows/deploy.yml`** — permaweb deploy, on **push to `main`** and via `workflow_dispatch`: builds the production bundle, publishes it to Arweave via Turbo, then repoints the `console` ArNS name's ANT record at the new manifest. A push carries no inputs, so `TARGET_UNDERNAME`/`TARGET_REF` resolve to `@` and the pushed SHA — merging to `main` publishes live `console.ar.io` with no approval step. Manual runs keep their own defaults (`staging` → `staging_console.ar.io`). TTL is 300s. **`.github/workflows/deploy-wallet-address.yml`** prints the deploy wallet's public address, since the secrets are write-only once set. A live `@` deploy hard-fails if `secrets.VITE_SOLANA_RPC` is empty, because the public mainnet-beta fallback fails *silently* at build time and would ship a broken console that looks fine in CI. One Solana wallet fills both roles (`DEPLOY_KEY` pays the upload, `ARNS_KEY` controls the name).

**Both deploy paths need `404.html`, for the same reason.** An `arweave/paths` manifest serves only the paths it lists, and `ario-deploy` derives the manifest's `fallback` from a `404.html` in the deploy folder — so `deploy.yml` runs `cp dist/index.html dist/404.html` before publishing. Without it every deep link (`/try`, `/upload`, `/arns`) 404s on direct arrival while the root loads fine and in-app navigation works — the 4.6.0 bug. The GitHub Pages workflow copies the same file for the same reason; if you add a third publish target, carry the step across.

**`.coderabbit.yaml`** makes CodeRabbit auto-review PRs targeting **`develop`**. It reviews only the default branch (`main`) out of the box, which under `feature → develop → main` is the one branch PRs never target first.

**`.npmrc` sets `legacy-peer-deps=true`.** Its comment says it exists because `@ar.io/sdk` was pinned to a prerelease that `@ar.io/wayfinder-core`'s `peerOptional ">=4.0.0"` rejected. That is now **stale** — the repo is on `@ar.io/sdk` 4.1.1 stable, which satisfies the peer range, so the flag (and the matching CI comment) can likely be dropped. Verify with a clean `npm ci` before removing.

## ESLint Configuration

Notable relaxed rules in `eslint.config.js`:
- `@typescript-eslint/no-explicit-any`: **off** — `any` is used liberally, especially for SDK interop
- `@typescript-eslint/no-non-null-assertion`: **off** — `!` assertions are allowed
- `no-console`: **off** — console.log is used in production code
- `@typescript-eslint/no-unused-vars`: **warn**
- `no-undef`: **off**, `no-case-declarations`: **off**
- `prefer-const`: **warn**
- `react-hooks/exhaustive-deps`: **warn** (not error)

## Styling

Tracks the ar.io brand kit (`https://ar.io/brand-kit/agents.json`, version 2026-08-07). `docs/STYLE_GUIDE.md` is the long form; the rules below are the ones that get silently broken.

### ar.io Brand Colors (Light Mode)

| Color | Hex | CSS Variable | Usage |
|-------|-----|--------------|-------|
| Primary | #5427C8 | `--color-primary` | CTAs, links, accents |
| Lavender | #DFD6F7 | `--color-lavender` | Gradients, backgrounds, footer |
| Black | #23232D | `--color-foreground` | Primary text, dark elements |
| White | #FFFFFF | `--color-background` | Page background |
| Card Surface | #F0F0F0 | `--color-card` | Cards only — **never** a full-page/section background |

**Extended palette:** `deep-dark` (#0e0a1c), `accent-lavender` (#D4C6FF), `lavender-wash` (#f1ecff), `warm-neutral` (#F6F4EF), `subtle-border` (#E6E4EF). Deep Dark and Accent Lavender are a pair — Primary only reaches ~1.9:1 on the dark washes, so accents *and focus rings* on dark surfaces must use `#D4C6FF` (add the `on-dark` class). `subtle-border` is for dividers on white; on a #F0F0F0 card it's invisible, so those keep `border-border/20`.

**Mute text with opacity, never another gray** (`/80` secondary, `/70` body, `/60` captions). `#4A4A58` "Body Gray" is retired.

### Typography

- **Headings**: Besley, weight **800** — applied globally to `h1`–`h6` in `globals.css`. Adding `font-bold` to a heading tag **downgrades it to 700**; that's the most common drift. Use `font-heading font-extrabold` only on non-heading elements.
- **Body text**: Plus Jakarta Sans (font-body)
- Both fonts loaded via `@fontsource-variable`

### Copy

**Don't be grandiose.** Say what changed and what it costs. No "never been
easier", no "revolutionary", no claim about how the user will feel. The
specific fact is always stronger: *"ARIO pays the registry directly and skips
the infrastructure fee"* beats *"the best way to buy a name"*.

**Never claim away a real requirement.** Buying a name needs a Solana wallet
holding ~0.0156 SOL on every route, so "no crypto needed" and "just a credit
card" are false — and they are exactly the lines a user quotes back the moment
a wallet prompt appears. State the constraint plainly and explain what it buys.

**One statement per screen.** If a host modal already names the purchase, the
panel inside it doesn't repeat the title, the terms, or the amount. Duplicated
copy reads as a bug, and it usually is one — see the modal contract below.

### Modals

**Headers come from `components/modals/ModalHeader.tsx`** — 40px `rounded-xl
bg-primary/20` tile, `text-lg font-extrabold` title, `text-xs` description,
top-aligned (`items-start`, so a wrapping title doesn't leave the icon floating
mid-block). All twelve modals use it; don't hand-roll another.

**A modal is already a card.** `BaseModal` is `bg-card border border-border/20
rounded-2xl` and pads its own content, so a panel embedded in one must not add
its own surface or horizontal padding — that's a frame inside a frame and
double inset. Panels written for a standalone page (the `/topup` fiat and
crypto steps) carry both and gate them on being embedded.

All modal chrome lives in `components/modals/BaseModal.tsx` (~20 consumers). It provides Escape-to-close, a Tab focus trap, `role="dialog"`/`aria-modal`, body scroll lock, focus restore on close, and a labelled close button — **don't reimplement any of that in a consumer.** Two things to know:

- `showCloseButton` defaults to **true**. A dismiss affordance is opt-out, not opt-in.
- Modals **nest** (`WalletSelectionModal` renders `BlockingMessageModal` inside its own `BaseModal`), so BaseModal keeps a module-level stack: only the topmost instance answers Escape and traps Tab, and the scroll lock lifts only when the last one closes. Preserve that if you touch it.
- Pass `dismissible={false}` for a modal that must not be cancelled mid-operation (Escape *and* backdrop-click are disabled). `BlockingMessageModal` uses this.

`FormEntry` has a matching contract: it renders `<label htmlFor={name}>`, so **the child control must set `id={name}`** or the association silently dangles.

### Focus & motion (do not re-implement per component)

`globals.css` supplies a global `:focus-visible` **outline** (2px solid primary, 2px offset — an outline, not a box-shadow, so it follows border-radius) and a global `prefers-reduced-motion` kill switch. In components: **don't** add `focus:outline-none` (it defeats the global rule) and **don't** add `focus:ring-*` (square-cornered, and now double-paints). The sole exception is Headless UI popup *containers* (`Listbox.Options`, `ComboboxOptions`, `MenuItems`, `PopoverPanel`), which keep `focus:outline-none`.

### Radii & rail

`rounded-2xl` is redefined to **20px** (brand cards are 20–24px), plus `rounded-3xl` (24px), `rounded-panel` (2rem), `rounded-hero` (2.5rem). Page containers use the `max-w-site` token (**1400px**) — not `max-w-7xl` (1280px) and not a hard-coded `max-w-[1400px]`.

### Key Files

- `src/styles/globals.css` - CSS custom properties
- `tailwind.config.js` - Tailwind color tokens and font families
- `docs/STYLE_GUIDE.md` - Comprehensive component patterns (colors, spacing, buttons, modals, forms)

## Common Patterns

### Service Panel Header
```jsx
<div className="flex items-start gap-3 mb-6">
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card">
    <Icon className="h-5 w-5 text-foreground" />
  </div>
  <div>
    <h3 className="font-heading text-2xl font-extrabold text-foreground mb-1">[Name]</h3>
    <p className="text-sm text-foreground/80">[Description]</p>
  </div>
</div>
```

### Card Component
```jsx
<div className="rounded-2xl border border-border/20 bg-card p-6 shadow-sm">
  {/* Card content */}
</div>
```

### Primary Button
```jsx
<button className="inline-flex items-center gap-2 bg-foreground text-white px-5 py-2.5 rounded-full font-semibold hover:opacity-90 transition-opacity">
  Button Text
</button>
```

### Privy Wallet Detection
```typescript
const { wallets } = useWallets();
const privyWallet = wallets.find(w => w.walletClientType === 'privy');
if (privyWallet) {
  const provider = await privyWallet.getEthereumProvider();
  // Use provider for Turbo client
}
```

## Key Dependencies

- `@ardrive/turbo-sdk`: Turbo services, multi-chain signing, USDC support
- `@ar.io/sdk`: ArNS resolution, InjectedEthereumSigner
- `@ar.io/solana-contracts` + `@solana/kit`: ANT spawn/instruction builders for the Solana ArNS paths
- `@ar.io/wayfinder-core` + `@ar.io/wayfinder-react`: Browse content verification
- `@privy-io/react-auth`: Email auth with embedded wallets
- `wagmi` + `ethers`: Ethereum wallets
- `@solana/wallet-adapter-*`: Solana wallets
- `@wallet-standard/app`: `getWallets().register()` — how `PrivySolanaBridge` makes the embedded wallet visible
- `arbundles`: Data item creation for X402
- `x402-fetch`: X402 payment protocol
- `zustand`: State management
- `@tanstack/react-query`: Server state
- `@stripe/react-stripe-js`: Fiat payments
- `hash-wasm`: Content hashing for Smart Deploy dedup (`fileHashCache`)
- `vite-plugin-pwa`: Compiles the Browse verification service worker (see Quick Start note)
- `vitest`: Unit test runner (pure-logic tests only)

## Routes

```typescript
'/', '/login', '/topup', '/upload', '/capture', '/deploy', '/deployments', '/share',
'/account', '/pages', '/balances', '/settings', '/try', '/browse',
// ArNS / domains — flat, one purpose per route (no tabs):
'/domains',        // Browse & search all registered names (BrowseDomainsPanel)
'/domains/:name',  // Deep-linkable public Name Detail page (NameDetailPage)
'/my-domains',     // Names the connected wallet owns or controls (MyDomainsPage)
'/arns',           // Register a name (ArNSBuyPanel; accepts ?q=)
'/returned-names', // Auctions (ReturnedNamesPanel)
'/pricing'         // Unified pricing: Storage + Domain Names (?type=domains seeds the tab)
```

Note: `/settings` renders `GatewayInfoPage`. `/login` renders `LandingPage`. Unknown routes redirect to home.

**ArNS/domains IA (flat, no tabs):** `/domains` is the Browse page, `/arns` is Register, `/returned-names` is Auctions — each its own route. There is NO tabbed DomainsPage; don't reintroduce in-page tabs for these (the app convention is one page per route). Browse cross-links to `/arns` ("Register a name").

**Pricing is unified at `/pricing`** (Storage calculator + Domain-name price table, chosen via a mode selector; `?type=domains` seeds the domains mode). The old pricing routes now **redirect** (kept alive): `/calculator`→`/pricing`, `/name-prices`→`/pricing?type=domains`, `/services-calculator`→`/pricing`. The operator-facing Services calculator + `PricingCalculator.tsx` were removed. `PricingCalculatorPanel` (storage) and `ArNSPriceTable` (domains) are reused by `PricingPage`; the panel's own header was hoisted out (the page provides it).

**Stripe is NOT provided app-wide.** `<Elements>` lives in `StripeElementsProvider`, mounted only around payment surfaces (`TopUpPage`, `BuyCreditsModal`, `GiftPage`) so Stripe.js stays off the homepage/critical path. `getStripePromise()` is lazy+cached — never re-add an eager `STRIPE_PROMISE` at the app root, and any new component calling `useStripe`/`useElements` must render under `StripeElementsProvider`.

**Deprecated/removed routes:** `/gift` and `/redeem` are gone (gifting was deprecated in favor of manual TX recovery on the top-up page). As of 4.1.0 the whole tree was **deleted** — `GiftPage`, `RedeemPage`, `GiftPanel`, `RedeemPanel`, the three `GiftPayment*Panel` components, and `getGiftPaymentIntent` in `paymentService.ts`. It had been unrouted and unreachable for some time, so it survived greps and audits while rendering nowhere. Recover from git history if it's ever needed.

URL params: `?payment=success`, `?payment=cancelled` (handled by PaymentCallbackHandler in App.tsx)

## Custom Events

- `refresh-balance`: Dispatched after payments to trigger balance updates across components
- `walletSwitch`: ArConnect event for Arweave wallet changes

## Important Hooks

**Core Hooks:**
- `useTurboConfig(tokenType?)` - Get Turbo SDK config for current mode
- `useEthereumTurboClient()` - Create authenticated Turbo client for ETH wallets (with caching + network switching)
- `useTurboWallets()` - Unified wallet detection across Arweave/Ethereum/Solana
- `useWalletAccountListener()` - Listens for wallet changes, clears caches on switch
- `useTheme()` - Theme management

**Upload Hooks:**
- `useFileUpload()` - Multi-chain file upload logic
- `useFolderUpload()` - Folder upload with manifest generation
- `useFreeUploadLimit()` - Fetch bundler's free tier; returns `{ freeUploadLimitBytes, freeTier }` (see Gotcha #10)
- `useUploadStatus()` - Track upload confirmation/finalization status

**Pricing Hooks:**
- `useWincForOneGiB()` - Storage pricing (returns `string | undefined`!)
- `usePerDataItemFee()` - Fixed per-data-item fee in winc from `/v1/rates` (returns `string | undefined`!); add to every cost calc — see Gotcha #9
- `useCreditsForFiat(usdAmount, address)` - USD → credits conversion
- `useCreditsForCrypto(tokenType, amount, address)` - Crypto → credits conversion
- `useX402Pricing(bytes)` - Calculate USDC cost for X402
- `useTokenBalance(tokenType)` - User's token balance for crypto payments
- `useCryptoPrice(tokenType)` - Current USD price for a token
- `useArNSPricing()` - ArNS domain pricing

**ArNS Hooks:**
- `usePrimaryArNSName(address)` - Fetch primary ArNS name
- `useOwnedArNSNames(address)` - Fetch all owned ArNS names

**Other Hooks:**
- `useGatewayInfo()` - Gateway information and status

## Important Utilities

**JIT Payment Utils** (`utils/jitPayment.ts`):
- `supportsJitPayment(tokenType)` - Check if token supports JIT payments
- `calculateRequiredTokenAmount()` - Calculate crypto needed for credits
- `formatTokenAmount()` / `fromSmallestUnit()` - Token amount formatting

**Other:**
- `clearEthereumTurboClientCache()` (`hooks/useEthereumTurboClient.ts`) - Clear cached signers/clients
- `isFileFree()` / `formatFreeLimit()` (`hooks/useFreeUploadLimit.ts`) - Free upload limit checks

## Node Polyfills

Vite config includes `vite-plugin-node-polyfills` for browser compatibility with Node.js APIs used by crypto/wallet SDKs. Polyfilled: `buffer`, `crypto`, `stream`, `os`, `util`, `process`, `fs`. If a new SDK import fails with "module not found" errors for Node builtins, check the polyfill `include` list in `vite.config.ts`.
