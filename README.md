# ar.io Console

A unified web application for uploading and accessing permanent data through the ar.io Network. Built with React 18, TypeScript, Vite, and multi-chain wallet support.

## Overview

The ar.io Console provides a streamlined interface for:
- **File uploads** to the permaweb with instant confirmation
- **Site deployment** with ArNS domain support
- **Credit management** (purchase and share)
- **ArNS domains** — buy and manage a name paying only in credits, with no SOL

## Quick Start

```bash
npm install       # Or: yarn install
npm run dev       # Start dev server at http://localhost:3000
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (4GB memory) |
| `npm run build:prod` | Production build with type checking (8GB memory) |
| `npm run build:staging` | Staging build with source maps |
| `npm run build` | Development build (no type check) |
| `npm run lint` | ESLint validation |
| `npm run type-check` | TypeScript checking |
| `npm run clean:all` | Full clean and reinstall |
| `npm run preview` | Preview production build |

## Tech Stack

- **React 18.3** with TypeScript 5.5, Vite 5.4
- **State**: Zustand (persistent + ephemeral), TanStack React Query v5
- **Wallets**: Arweave (Wander), Ethereum (Wagmi/RainbowKit/Privy), Solana (wallet-adapter)
- **Payments**: Stripe (fiat), native crypto, X402 protocol (Base USDC)
- **Styling**: Tailwind CSS, Besley + Plus Jakarta Sans fonts
- **Key SDKs**: `@ardrive/turbo-sdk` (pinned exactly — see note below), `@ar.io/sdk` 4.1.1

## Environment Variables

Create a `.env` file:

```bash
VITE_NODE_ENV=production              # Controls mainnet vs testnet
VITE_PRIVY_APP_ID=...                 # Required for email auth
VITE_WALLETCONNECT_PROJECT_ID=...     # Optional
VITE_SOLANA_RPC=...                   # Required for prod — full provider URL incl. token
```

`VITE_SOLANA_RPC` is the single Solana RPC for both the store config and the wallet
adapter. It falls back to public `api.mainnet-beta.solana.com`, which is fine for
local work and heavily rate-limited for anything else — live deploys fail closed if
it is unset. Vite inlines it into the bundle, so the provider token in it is public
once shipped; the endpoint is protected by referrer and method whitelists on the
provider side rather than by hiding the URL.

## Routes

```
/              # Landing/Home
/topup         # Buy credits (fiat/crypto)
/upload        # File upload
/capture       # Web page capture
/deploy        # Site deployment
/deployments   # Deployment history
/share         # Share credits
/account       # Account overview
/pages         # Link-in-bio page builder
/browse        # View permaweb content, with optional verification
/domains       # Browse & search every registered name
/domains/:name # One name's public detail page
/arns          # Register a name
/my-domains    # Names this wallet owns or controls
/returned-names # Auctions
/balances      # Balance checker
/pricing       # Storage + domain-name pricing
/settings      # Configuration and gateway info
/try           # Try it now (quick upload demo)
```

`/calculator`, `/name-prices` and `/services-calculator` redirect to `/pricing`.
`/gift` and `/redeem` were removed in 4.1.0.

External resources are available via the navigation menu:
- **Developer Docs**: [docs.ar.io](https://docs.ar.io)
- **Network Dashboard**: [gateways.ar.io](https://gateways.ar.io)

## Wallet Capabilities

| Feature | Arweave | Ethereum/Base | Solana |
|---------|---------|---------------|--------|
| Buy Credits (Fiat/Crypto) | ✅ | ✅ | ✅ |
| Upload/Deploy/Capture | ✅ | ✅ | ✅ |
| Share Credits | ✅ | ✅ | ✅ |
| Update ArNS Records | ❌ | ❌ | ✅ |
| X402 USDC Uploads | ❌ | ✅ (Base only) | ❌ |

ArNS writes are signed by a Solana wallet, but **that wallet never needs SOL** —
Turbo pays the Solana fees and rent, and the user pays in Turbo Credits. Signing
in with an email address creates a Solana wallet automatically, so someone who
has never held cryptocurrency can buy and run a name.

Four things are not covered and still cost the signer a small amount of SOL:
setting a primary name, releasing a name, pointing it at a different name token,
and editing the name's own details. Buying from an auction and paying in ARIO
also use the wallet's own SOL. The interface says which is which before you
commit rather than at the wallet prompt.

## A note on the turbo-sdk pin

`@ardrive/turbo-sdk` is pinned to an exact prerelease and must stay that way.
Stable `1.42.0` sorts *above* `1.42.0-alpha.x` in semver and contains no ArNS
surface at all, so a caret range or a routine `npm update` silently removes
domain purchasing — and nothing fails until someone tries to buy a name.

## Documentation

For detailed development guidance including architecture, hooks reference, state management patterns, and critical implementation details, see **[CLAUDE.md](./CLAUDE.md)**.

For styling patterns and component guidelines, see **[STYLE_GUIDE.md](./docs/STYLE_GUIDE.md)**.

## Links

- **ar.io Console**: [console.ar.io](https://console.ar.io)
- **ar.io Website**: [ar.io](https://ar.io)
- **Documentation**: [docs.ar.io](https://docs.ar.io)
- **GitHub**: [github.com/ar-io](https://github.com/ar-io)
- **Discord**: [discord.gg/HGG52EtTc2](https://discord.com/invite/HGG52EtTc2)
- **Twitter/X**: [@ar_io_network](https://twitter.com/ar_io_network)
