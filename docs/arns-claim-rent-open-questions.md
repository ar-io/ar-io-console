# ArNS "Claim Rent" — Feasibility & Open Questions for the ar.io Team

**Status:** Parked (investigated 2026-08). Not implemented pending answers below.

## What was requested

A "claim rent" action a user runs when their ArNS name expires, to **burn the
now-useless ANT and reclaim the locked Solana account rent**.

## What we found

On Solana, every ArNS name buy locks ~0.076 SOL as rent-exempt deposits across
several accounts. Reclaiming it is **not a thin SDK call** and does **not**
recover the full amount:

- **The `@ar.io/sdk` ANT/ARIO clients expose no burn or close-account method.**
  The only teardown-ish call is `releaseName` — which is permabuy-only, leaves
  the ANT intact, allocates a *new* `returnedName` PDA, and reclaims nothing net
  for the user (it opens a returned-name auction).
- The instructions that actually free the lamports (`closeAntRecord`,
  `closeAntRecordMetadataForOwner`, `closeAclPage`/`closeAclConfig`,
  `closeAntControllers`, `closeAntConfig`, then mpl-core `burnV1`) exist **only
  as raw codama builders in `@ar.io/solana-contracts`** (now a directly-declared
  dependency, `1.0.1`, as of the primary-name-remove work). Using them still
  means hand-assembling a multi-instruction teardown.
- **Only the ANT-side rent is user-reclaimable.** The `ArnsRecord` PDA rent is
  either consumed by `releaseName`'s new PDA or, on lease expiry/prune, refunded
  to **whoever cranks the prune — not the former owner**.
- **Ordering is an irreversible foot-gun:** if `burnV1` runs before the ANT PDAs
  are closed, they orphan and only the **protocol admin** can ever recover that
  rent (`adminCloseOrphanedAntState`, `has_one = authority`). PDAs must close
  first, burn last.
- **A burned ANT is gone forever** — it can't be reused, reassigned, or
  re-pointed at a renewed name.

**Verdict:** Feasible only by building a bespoke teardown transaction on the
now-declared `@ar.io/solana-contracts` raw builders — with real irreversible-loss
risk and unresolved on-chain permission questions. Not
worth shipping until the team confirms the questions below (ideally by hoisting
a first-class `burnAnt`/`reclaimRent` method onto the SDK — reportedly a planned
"Phase 7").

## Open questions for the ar.io team

1. **Is user-invoked `closeAntConfig` / `closeAntControllers` on a live,
   still-owned ANT actually permitted by the deployed on-chain (Rust) handlers,
   or only intended post-expiry?** The JS SDK can't tell us; only the program
   knows.
2. **Does mpl-core `burnV1` succeed against ar.io ANTs** given their Attributes
   / Owner plugin chain (no permanent-freeze or transfer-delegate that blocks a
   burn)?
3. **What is the per-account SOL breakdown**, so the UI can quote the *actually
   reclaimable* subtotal (asset + ario-ant PDAs) versus the unrecoverable
   `ArnsRecord` portion?
4. **Will the team hoist a first-class `burnAnt` / `reclaimRent` method onto the
   `@ar.io/sdk` Solana client** (the "Phase 7" interface hoist)? We'd much
   rather wrap that than depend on raw codama instructions from an undeclared
   transitive package.

## If we proceed later (recommended shape)

- (`@ar.io/solana-contracts` is already a direct, version-pinned dependency.)
- `useReclaimAntRent` hook: enumerate the ANT's records/ACL pages, emit the
  `close*` instructions, then `burnV1`, signed by the Solana wallet adapter.
  **Enforce PDA-close-before-burn ordering.**
- UI gate: show "Reclaim rent (destroys ANT)" **only** when the wallet is the
  live MPL Core owner **and** the name has fully expired past grace (no longer
  resolves), so the destructive action can't orphan a live name. Present it as
  permanent ANT deletion, and quote only the actually-reclaimable subtotal.
