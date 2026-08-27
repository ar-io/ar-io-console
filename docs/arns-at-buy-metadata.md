# ArNS At-Buy Metadata — SDK PR + Console Follow-Up

**Status:** Blocked on upstream. Console wiring is ready to add once a new
`@ar.io/sdk` alpha ships the change.

## The gap

`buyRecord` (atomic path, no `processId`) mints the ANT with **name-only**
state, so a freshly bought name resolves to the default AR.IO logo until a
separate `setBaseNameRecord` + metadata writes (one signature each). The spawn
machinery already forwards ticker/target/logo/description/keywords into the
single `initialize` instruction — `buyRecord` just didn't expose it.

## Upstream PR

**[ar-io/ar-io-sdk#698](https://github.com/ar-io/ar-io-sdk/pull/698)** (base
`alpha`, from `vilenarios:feat/atomic-buy-ant-metadata`). Adds optional
`antState?: ArNSBuyAntState` to `BuyRecordParams`, threads it into the atomic
mint (`state: { name, ...antState }`), ignored-with-warn when `processId` is
set, plus a pure `validateSpawnAntState` guard. 418/418 SDK unit tests pass.

### Caveats baked into the design
- **TTL can't be set at mint** (`initialize` has no TTL field) — the `@` target
  sets atomically, but a *non-default* TTL still needs a post-buy
  `setBaseNameRecord` (the console's existing Edit-details editor).
- **Long description + many keywords can exceed the 1232-byte tx limit** (the
  ALT fallback compresses accounts, not instruction data). Keep long text on the
  post-buy path; the small resolution-critical fields (`transactionId`,
  `ticker`, `logo`) fit the single buy tx.

## Console wiring (do once the SDK publishes)

1. Bump `@ar.io/sdk` to the alpha that includes #698.
2. `useBuyArNSName.ts`: add `antState?` to `BuyArNSNameInput` + the structural
   `ARIOBuyWriteable.buyRecord` type, and pass it through to `buyRecord`.
3. `ArNSBuyPanel`: add an **optional, collapsed "Add details" section** (reuse
   the field set + validation from `EditDetailsModal` / `useSetArNSMetadata`)
   collecting the `@` target + ticker/logo (the atomic-safe fields), leaving
   long description/keywords to the post-buy editor we already ship.
4. UAT on **devnet** with a funded Solana wallet: buy a name with `antState`,
   confirm one signature + immediate resolution to the target. (Human-only —
   requires signing.)

Until then, the post-buy "Edit details" CTA on the purchase success screen
covers the same need in a second step.
