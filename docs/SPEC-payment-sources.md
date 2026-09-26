# SPEC: Payment sources (pay with credits, card, or any crypto you hold)

**Status:** Approved. This is a plan: Phase 1 is in progress on `feat/payment-picker`; Phase 2 is not started.
**Author:** Product, drafted with Claude Code
**Date:** 2026-09-23
**Owning surface:** ar.io Console (`ar-io-console`)
**Target:** the first release after 4.10.0, in its own staging cycle
**Related:** Top Up, the name checkout (`/arns`), the linked Solana wallet

---

## 1. Summary

Every payment surface in the console offers the same three choices: **Credits**, **Card**, and **Crypto**. Crypto is one dropdown that lists every token the user can pay with, from **every wallet they have connected**: the wallet they signed in with (the session wallet) and, when they have one, the Solana wallet they linked for ArNS.

The case this unlocks: someone signed in with an Arweave or Ethereum wallet who has linked a Solana wallet can pay with **SOL or USDC on Solana** for a top-up or a name. Credits always land on the account the payment is for, because the destination travels on-chain with the payment.

The work ships in two phases. Phase 1 changes only the picker. Phase 2 changes where a payment can come from. Keeping them apart means any regression in either is traceable to one change.

## 2. Problem

- **An Arweave user who wants a name has two practical ways to pay:** a card, or AR, which confirms slowly. They have usually already linked a Solana wallet to own the name, and it may hold SOL or USDC, but the console will not let them spend it.
- **The name checkout is a flat row of equal cards.** An Ethereum session sees Card, Base USDC, Base ETH, USDC, POL, ETH and ARIO. Adding the linked wallet's two tokens makes nine or ten. It stops scanning.
- **The rule behind the restriction is right, but it no longer needs to be a restriction.** The console refuses to pay from the linked wallet on a non-Solana session because a top-up with no stated destination credits whoever sent it. That once stranded credits and cost buyers real SOL (see `CLAUDE.md`, "PAYER vs OWNER"). The fix is to state the destination, not to forbid the wallet.

## 3. Goals and non-goals

### Goals

- One picker, three choices, on the name checkout and on Top Up.
- An Arweave or Ethereum session with a linked Solana wallet can pay with SOL or USDC on Solana, for top-ups and name purchases.
- **No regression in any existing payment.** Every payment that works today works identically, in the same number of approvals, crediting the same account.
- Nothing that moves money depends on the user understanding which wallet pays and which is credited. The interface says it once, where it matters.

### Non-goals

- **Pay-as-you-go uploads, deploys, captures and Pages publishing.** The upload is signed by the session wallet and funded by the same client (`OnDemandFunding`), so paying from a second wallet would need a second client and a second approval per upload. An Arweave session exists so uploads are not a series of approvals. (Phil, 2026-09-23.)
- **Linking a second Ethereum or Arweave wallet.** The console links exactly one extra wallet, a Solana one. The model in § 6 makes adding another a matter of registering a source; building the linking is not in scope.
- **Returned-name auctions.** They are paid in ARIO from the linked wallet and are unchanged.
- **Pricing.** No fee, rate or price changes. See § 12 for the one pricing question this raises.

## 4. Decisions already made

These were settled with Phil on 2026-09-23 and are not reopened here:

| Question | Decision |
| --- | --- |
| Which surfaces | Top Up and the name checkout. Pay-as-you-go is excluded. |
| Which session types gain linked-wallet sources | Arweave and Ethereum. |
| Release | Its own staging cycle, after 4.9.0. |
| Real-money verification | Phil runs the testnet test in § 9.4 before production. |
| Top Up, Solana wallet linked but not connected | Show nothing from it. |
| Solana wallet not linked | Show nothing from it, on either surface. |
| Picker shape | Credits, Card, Crypto (one dropdown). |

## 5. Terms

Session wallet
: The wallet the user signed in with (`address`, `walletType` in the store). It is the payer of every credits-settled action and the default credit target.

Linked wallet
: The Solana wallet an Arweave or Ethereum session links for ArNS (`useLinkedSolanaWallet`: `linkedSolanaAddress`, `linkedSolanaWalletName`). It signs name purchases as the owner. A Solana session has no separate linked wallet.

Payment source
: A pair of (wallet, token) the user can pay with, for example (linked wallet, `solana-usdc`).

Credit target
: The account a top-up credits. On Top Up it is the **Buying For** address, which defaults to the session wallet. On the name checkout it is always the session wallet, because that is the balance the purchase spends.

Destination
: The credit target, carried inside the payment transaction so the payment service credits it instead of the sender. The SDK parameter is `turboCreditDestinationAddress`.

## 6. How it works

### The model

A source is available when its wallet is connected (or, on the name checkout, linked) and can sign for its token. Sources are derived, never configured:

- **Session sources:** `availableTokensForWallet(session.walletType)`, unchanged.
- **Linked sources:** `solana` and `solana-usdc` from the linked wallet, when the session is Arweave or Ethereum and the visibility rules in § 7.5 allow them.

A payment has a source and a credit target. **When the source's address differs from the target's, the payment must carry the target as its destination.** When they are the same, no destination is added, which is exactly how every payment works today.

### Why this is safe to build

Each of these was checked against the code on 2026-09-23. File references are to turbo-sdk 2.1.0 and to `ar-io/ar-io-bundler` on `develop`.

| Fact | Evidence |
| --- | --- |
| The destination is written **on-chain**, for every token. SOL and USDC use a memo; ARIO inherits it from the SPL class; ETH, Base ETH, Polygon and ERC-20s use calldata; AR uses a tag. | `lib/esm/common/token/solana.js:57`, `spl.js:70`, `erc20.js:54`, `arweave.js`; `ARIOToken extends SplToken` |
| The service credits the destination, and explicitly accepts **any supported wallet type**, not just the payment's own chain. | `payment-service/src/utils/topUpDiscovery.ts:114` |
| An unrecognisable destination is **rejected** so the payment can be refunded, rather than credited to the sender. | `topUpDiscovery.ts`, `resolveUserAddressType(...) === false` branch |
| An Arweave address is always resolved as Arweave: the Arweave format is checked before Solana's. An EVM `0x` address is unambiguous. | `payment-service/src/utils/base64.ts`, `addressTypeResolutionOrder` |
| Recovering a stuck payment resubmits only the transaction id, so the destination is re-read from the chain and cannot be lost. | `submitFundTransaction` posts `{ tx_id }` only, `common/payment.js:382` |
| Crypto top-up history is keyed on the **credited** account and carries the sender, so the payment shows in the session user's own history. | `payment-service/src/database/postgres.ts`, `getPaymentHistory` filters `destination_address` |
| The console already sends a destination for **Buying For** top-ups. | `CryptoConfirmationPanel.tsx:57-59`, `:143` |

The one thing not provable from code is that production credits an Arweave address from a Solana memo end to end. § 9.4 is that test.

## 7. Experience

### 7.1 The picker

Each surface shows only the choices that apply to it:

| Surface | Credits | Card | Crypto |
| --- | --- | --- | --- |
| Name checkout | Yes | Yes | Yes |
| Top Up | No (the user is buying credits) | Yes | Yes |

The name checkout:

```
Pay with
( ) Credits    2.45 credits             Not enough, need 6.61
( ) Card       via Stripe               $49.51
(•) Crypto     [ ARIO · Best price · 20,715 ARIO           ▾ ]
                 Paid from your Solana wallet
```

Top Up:

```
Pay with
( ) Card       via Stripe
(•) Crypto     [ USDC · Solana wallet · 12.40 USDC          ▾ ]
                 Paid from your Solana wallet (7xKd…p9Qa).
                 Credits go to your Arweave wallet (vLRH…3eWw).
```

- **Three options, one line each.** The picker is a radio group, built with Headless UI so keyboard and focus behave like the rest of the app.
- **Choosing Crypto is one click.** The dropdown is preselected (§ 7.2), so it is there to change the choice, not to make a second one.
- **Each option shows what it costs in its own unit,** so the choice is made on price, not on a label.

### 7.2 The crypto dropdown

Each row states four things, in this order: token, the wallet it comes from, the user's balance, and the price.

```
From your Arweave wallet
  AR                        1.02 AR        4.61 AR      about 40 min
From your Solana wallet
  ARIO   Best price         51,203 ARIO    20,715 ARIO
  SOL                       0.1999 SOL     0.2381 SOL
  USDC                      12.40 USDC     49.51 USDC
```

- **Rows are grouped by wallet**, so "which wallet will open?" is answered before the user asks. The group heading names the wallet, not the chain.
- **A row the user cannot afford is shown disabled with its reason,** never hidden. An unknown balance reads as affordable, matching `paymentOptions.ts` today: a failed balance lookup must never make a funded wallet look empty.
- **Preselection**
  - Name checkout: ARIO when it is available and affordable (the cheapest route, and today's "Best price" badge); otherwise the fastest affordable source.
  - Top Up: the first affordable source on a fast chain (USDC on Solana, SOL, USDC on Base, ETH on Base), then the session wallet's own token.
- **A selection survives a re-render while it stays available,** and falls back to the preselection only when it does not. This is the rule `TopUpPanel` already follows in its "keep the selected token payable" effect.
- **A slow token is labelled with its wait** in its row, such as "about 40 min" for AR, and is still offered. On the name checkout it follows the two-step flow in § 7.8.
- **On Top Up, ARIO is a row like any other, placed after the preselected token.** It carries a small "Lower fee" tag and nothing more: no badge colour, no preselection, no banner. It pays the 25% infrastructure fee instead of 35%, and its price column shows the difference as ordinary numbers. ARIO keeps its prominent "Best price" badge on the name checkout, where it pays the registry directly.

### 7.3 The name checkout, by session type

| Session | Credits | Card | Crypto sources |
| --- | --- | --- | --- |
| Solana | Unchanged | Unchanged | ARIO, SOL, USDC on Solana, all from the session wallet. Unchanged. |
| Arweave, no linked wallet | Unchanged | Unchanged | ARIO and AR, as today. |
| Arweave, linked wallet | Unchanged | Unchanged | AR from the session wallet; **ARIO, SOL, USDC on Solana** from the linked wallet. |
| Ethereum, linked wallet | Unchanged | Unchanged | The session wallet's EVM tokens; **ARIO, SOL, USDC on Solana** from the linked wallet. |

For SOL or USDC from the linked wallet, the purchase runs exactly like a Solana session paying in SOL today: a top-up, then the purchase. It is **two approvals, both in the same Solana wallet**: the transfer, then the owner signature the purchase needs anyway. The top-up's destination is the session wallet, whose credits the purchase spends.

### 7.4 Top Up

Top Up keeps its Card and Crypto split (`paymentMethod: 'fiat' | 'crypto'`) and **Buying For**. The crypto token grid becomes the dropdown in § 7.2.

When the paying wallet is not the Buying For account, one line under the dropdown says so, with both addresses shortened:

> Paid from your Solana wallet (7xKd…p9Qa). Credits go to your Arweave wallet (vLRH…3eWw).

That line appears only when the two differ. A same-wallet top-up looks exactly as it does today.

### 7.5 When linked-wallet sources appear

The name checkout and Top Up treat a linked wallet differently, because only the name checkout needs that wallet regardless:

| Linked Solana wallet | Top Up | Name checkout |
| --- | --- | --- |
| Linked and connected | Shown | Shown |
| Linked, not connected | Hidden | Shown, balances read from the saved address |
| Not linked | Hidden | Hidden |

The name checkout shows a linked-but-disconnected wallet because buying a name requires that wallet at the **Buy** step (`SolanaGateButton`). Choosing SOL meets the same connection step, and one connection then covers both paying and owning. Top Up has no other reason to ask for that wallet, so it does not.

### 7.6 Copy

These strings are the source of truth. They follow the house copy rules: no em dashes, and no claims beyond what is true.

| Where | Text |
| --- | --- |
| Picker heading | Pay with |
| Crypto group heading | From your Solana wallet / From your Arweave wallet / From your Ethereum wallet |
| Payer and target line (Top Up, only when they differ) | Paid from your Solana wallet (SHORT_ADDRESS). Credits go to your Arweave wallet (SHORT_ADDRESS). |
| Name checkout, under a linked-wallet source | Paid from your Solana wallet |
| Disabled row, low balance | Not enough USDC |
| Disabled row, no SOL for the fee (USDC on Solana) | Needs 0.000005 SOL for the network fee |
| Slow token row | about WAIT |
| ARIO row on Top Up | Lower fee |
| Slow token, name checkout, before paying | This payment takes about WAIT to reach your balance. You can leave this page. Once it arrives, buy the name with credits in one step. |
| Slow token, name checkout, waiting | Waiting for your payment to confirm. You can leave this page; your credits arrive either way. |
| Slow token, name checkout, credits arrived | Your credits have arrived. Buy NAME with credits. |
| Slow token, name taken while waiting | NAME was registered while your payment confirmed. Your credits are in your balance for another name or for uploads. |
| Payment history, sender differs from viewer | Paid from SHORT_ADDRESS |
| Credits, short | Not enough, need AMOUNT |

Replace the following:

- SHORT_ADDRESS: the first four and last four characters of the address.
- AMOUNT: the shortfall in credits.
- WAIT: the token's expected time to credit, from the table in § 7.8.
- NAME: the name being bought.

### 7.7 States

The picker behaves the same way in every state that can occur mid-payment:

| State | Behaviour |
| --- | --- |
| Balances loading | Rows render with a placeholder amount; preselection waits for balances, then picks once. |
| Balance lookup failed | The row stays enabled (unknown reads as affordable) and shows no amount. |
| USDC on Solana, wallet cannot pay the network fee | The row is disabled when the wallet's SOL balance is **known** to be below 5,000 lamports (0.000005 SOL), with "Needs 0.000005 SOL for the network fee". When the SOL balance is unknown, the row is enabled and the fee notice (`CryptoConfirmationPanel`) shows before the wallet opens. See § 7.9. |
| Linked wallet disconnects before signing | Its rows disappear on Top Up and become connect-required on the name checkout. A selected row falls back to the preselection. Nothing has been sent. |
| Linked wallet disconnects after the transfer is sent | The payment is on-chain with its destination. The pending-transaction record and `PendingTxRecoveryBanner` recover it by transaction id. |
| x402-only mode | Card and every credits top-up are withdrawn, as today (`creditPurchasesUnavailable`). ARIO for names survives, because it pays the registry directly. |
| Payment service unreachable | Unchanged from today. |
| Credits arrive slowly | The name checkout's existing credit wait (`useArNSTokenTopUp`) polls the **session** balance, the credit target, and times out with the money-safe message it already shows. A slow token never reaches this wait, because it uses the two-step flow in § 7.8. |

### 7.8 Slow tokens on the name checkout

One token takes longer to credit than the name checkout's credit wait (five minutes, `CREDIT_POLL_TIMEOUT_MS` in `useArNSTokenTopUp.ts`): AR. It is offered there already, and has this problem. It stays on offer, with a flow built for the wait instead of a spinner that times out.

**A token is slow when its p90 time to credit exceeds the credit wait.** The times come from the payment service, not the SDK, whose polling (`pollingOptions` per token) covers only the wallet's own confirmation. The service re-checks pending payments about every 60 seconds for up to 24 hours, and credits a payment that is already confirmed during the submit request itself.

The following table is the Turbo backend's answer of 2026-09-23: production code defaults (no overrides are set), measured from submission to credit over the preceding 180 days:

| Token | Rule before crediting | Median | p90 | Slow |
| --- | --- | --- | --- | --- |
| AR | 18 confirmations | ~39 min | ~51 min | Yes |
| ETH (Ethereum) | 5 confirmations; a reverted transaction is never credited | ~1.5 min | ~2.4 min | No |
| USDC (Ethereum) | 5 confirmations | ~1.5 min | ~1.8 min | No |
| POL | 12 confirmations | ~1 min | ~2 min | No |
| ETH and USDC (Base) | 5 confirmations | ~40 s | Under 1 min | No |
| SOL | Finalized | ~47 s | ~66 s | No |
| ARIO and USDC (Solana) | Finalized | Seconds | Under 90 s | No |

- The wallet's own time before submission is extra.
- AR and ETH have rare outliers of several hours; the longest was about 13 hours. The fast flow's timeout stays sized on p90 and keeps its money-safe message for the outlier, rather than being stretched to cover it.
- In code this is one table, `tokenSettlement.ts`, carrying the date and source of the figures. "Slow" is derived from it, never hardcoded per surface.
- So Ethereum mainnet ETH and USDC stay on the name checkout in the single flow. They are fast enough; they are costly in gas, which is the user's call to make.

A slow token turns the purchase into two explicit steps:

1. **Pay.** The user sends the payment. The console records it as a pending top-up (transaction id, token, credit target, and the name being bought) and says the user can leave the page.
2. **Buy with credits.** When the credits arrive, the checkout, or the banner on any page, offers the purchase with credits: one click, one owner signature.

The split is honest about what happens: the payment becomes credits, and the credits buy the name. Nothing is reserved while the payment confirms, so if someone else registers the name first, the user keeps the credits and the copy says so. The flow exists to prevent two outcomes: a spinner that runs for forty minutes, and a timeout that reads like a failure after the money has moved.

Fast tokens keep the single flow in § 7.3.

### 7.9 The network fee for USDC on Solana

A USDC transfer on Solana is paid in SOL. The SDK builds it with no priority fee and creates Turbo's token account idempotently (`spl.js`, `createAssociatedTokenAccountIdempotentInstruction`), and that account exists on mainnet, so the transfer costs the base signature fee: 5,000 lamports (0.000005 SOL). That is the threshold, taken from how the transaction is built rather than guessed.

- The console disables the row only when the SOL balance is known to be below it, because an unknown balance must never block a payment that would succeed.
- If the SDK adds a priority fee in a later version, this threshold must follow it. A test pins the value to the SDK's transaction shape.

### 7.10 Accessibility and mobile

- The picker is a radio group and the dropdown a Headless UI `Listbox`, so arrow keys, Enter and Escape work and focus follows the global `:focus-visible` rule. No `focus:outline-none` except on the `Listbox.Options` container, per `CLAUDE.md`.
- Disabled rows are reachable and announce their reason, not just their dimmed state.
- On phones the picker is one column. Dropdown rows wrap balance and price under the token rather than truncating them. There is no horizontal scroll at 375px.
- Token logos keep the existing set: ARIO and SOL on the shared dark disc, and USDC's own blue mark, unaltered (`ArNSPaymentSelector.tsx`, `TOKEN_COIN`).

## 8. Payment correctness

This section is the contract. A change that breaks any item in it is a regression, whatever else it achieves.

### 8.1 Invariants

| ID | Invariant |
| --- | --- |
| P1 | **A payment whose source address differs from its credit target carries the target as its destination.** One helper builds every top-up call and throws if asked to build a cross-wallet payment without one. |
| P2 | **A payment whose source is the credit target carries no destination.** Every existing same-wallet payment sends the same transaction it does today. |
| P3 | On the name checkout the credit target is the session wallet, always. It is never the linked wallet on an Arweave or Ethereum session. |
| P4 | A payment client is built from the **source's** wallet and token, never the session's (`solanaClientToken`, and the Ethereum client's token override). |
| P5 | The amount is converted with the source token's own decimals (`getTokenDecimals`). |
| P6 | The settlement wait reads the **credit target's** balance, never the source wallet's. Reading the payer's would wait five minutes for credits that landed elsewhere. |
| P7 | ARIO on the name checkout pays the registry directly, as today. It never becomes a top-up. |
| P8 | Card payments are unchanged in every flow. |
| P9 | Pay-as-you-go uploads, deploys, captures and Pages publishing are unchanged. |
| P10 | A pending-transaction record carries the source token, the transaction id and the credit target, so recovery works and the recovery screen can say where the credits went. |

### 8.2 What must not change

Each of these flows must behave identically before and after, including the number of wallet approvals:

- A Solana session buying a name with credits, card, ARIO, SOL or USDC on Solana.
- An Arweave session buying a name with credits, card, ARIO or AR.
- An Ethereum session buying a name with credits, card, ARIO, or any of its EVM tokens.
- A top-up by card, for yourself and for another Buying For address.
- A top-up with any token from the session wallet, for yourself and for another Buying For address.
- Recovery of a stuck top-up from the banner.
- Every pay-as-you-go upload path.
- x402-only mode.

### 8.3 Tests

These suites must stay green without changes to their existing assertions: `paymentOptions`, `walletTokens`, `settlementRoute`, `settlementMechanism`, `cardPlan`, `buyDecisions`, `purchaseMachine`, `pollPurchase`, `jitPayment`, `awaitCreditSettlement`, `getExplorerTxUrl`, `solanaToken`, `tokenEndpoints`.

New logic lives in pure modules so the node-only test harness covers it:

| Module | Covers |
| --- | --- |
| `paymentSources.ts` | Deriving sources from the session and linked wallet; the visibility table in § 7.5; grouping; preselection; selection fallback. |
| `creditDestination.ts` | P1 and P2: the destination for every (source, target) pair, including same-wallet, cross-wallet, a third-party Buying For address, and the throw when a cross-wallet payment has none. |

Required cases, at minimum:

- Every row of the tables in § 7.3 and § 7.5.
- A Solana session produces exactly today's sources, with no destination on any payment (P2).
- An Arweave session with a linked wallet produces a destination equal to the session address for SOL and USDC (P1, P3).
- A Buying For address that is the linked wallet itself produces no destination (P2).
- A Buying For address that is a third wallet produces a destination equal to that wallet.
- Preselection on the name checkout picks ARIO when affordable and falls back correctly when it is not.

### 8.4 Real-wallet test matrix

Run these on staging with real wallets before production, after § 9.4. The name checkout on testnet uses a real devnet name; Top Up uses small amounts.

| # | Session | Linked | Surface | Pay with | Expect |
| --- | --- | --- | --- | --- | --- |
| 1 | Arweave | Solana, connected | Top Up | USDC on Solana | Credits on the Arweave address; history row shows it with the Solana sender |
| 2 | Arweave | Solana, connected | Top Up | SOL | Same as 1 |
| 3 | Arweave | Solana, connected | Name checkout | USDC on Solana | Two approvals in Phantom; name owned by the Solana wallet; credits debited from the Arweave account |
| 4 | Arweave | Solana, not connected | Name checkout | SOL | Connection prompted at Buy; then as 3 |
| 5 | Ethereum | Solana, connected | Name checkout | SOL | As 3 |
| 6 | Ethereum | none | Name checkout | Base USDC | Unchanged from today |
| 7 | Solana | n/a | Name checkout | USDC on Solana | Unchanged from today |
| 8 | Arweave | Solana, connected | Top Up | USDC on Solana, Buying For a third wallet | Credits on the third wallet |
| 9 | Arweave | Solana, connected | Top Up | Close the tab after approving | Recovery banner resubmits; credits on the Arweave address |
| 10 | Arweave | Solana, no SOL | Top Up | USDC on Solana | Row disabled, or the fee notice before the wallet opens |
| 11 | Arweave | Solana, connected | Top Up | ARIO | Credits on the Arweave address at the 25% fee. No ARIO top-up has been credited since that fee went live, so this is its first real proof |
| 12 | Arweave | none | Name checkout | AR | Two-step flow: pay, leave, return to "Buy NAME with credits" |

## 9. Implementation plan

### 9.1 Phase 1: the picker, with today's sources

- Replace the name checkout's row of cards and Top Up's token grid with the § 7.1 picker and § 7.2 dropdown.
- **Sources are exactly today's**: `availableTokensForWallet(session)` plus ARIO on the name checkout. No payment is routed differently.
- `paymentSources.ts` lands here with session sources only, so Phase 2 adds to it rather than rewriting it.
- This phase is a pure interface change. Every item in § 8.2 is testable against it, and no money moves differently.

### 9.2 Phase 2: linked-wallet sources

- Add linked sources to `paymentSources.ts` under the § 7.5 rules.
- Add `creditDestination.ts` and route every top-up call through it (P1, P2).
- **Name checkout:** `useArNSTokenTopUp` passes the session address as the destination when the source is the linked wallet, and its credit wait reads the session balance (P3, P6).
- **Top Up:** `CryptoConfirmationPanel`'s `canPayDirectly` and its signing branch key on the **source's** wallet type, not the session's.
- **Recovery:** the pending-transaction record gains the source and the target (P10).
- **History:** a crypto row whose `senderAddress` is non-empty and differs from the viewer's address shows "Paid from SHORT_ADDRESS". The field is in the SDK's type already (`types.d.ts:188`). Rows credited before about 2025-10-27 return an empty string, because the column was never backfilled, so an empty sender shows nothing rather than "Paid from unknown". x402 payments never appear in this endpoint, which is unchanged by this work.
- Behind a flag, `linkedWalletSources`, on in development and custom modes, and off in production until § 9.4 passes. Turning it off restores Phase 1 behaviour exactly.

### 9.3 Documentation

- `CLAUDE.md`: replace "The payment menu derives from the SESSION wallet … by construction rather than by guard" and the `creditTopUpsUnavailable` rationale with P1 to P3, and record why: the old rule was correct for payments without a destination, and every payment now carries one when it needs it.
- `docs/CONSOLE-PRODUCT-GUIDE.md`: the wallet capability matrix gains linked-wallet payments.
- The CHANGELOG entry is written with the release commit, not before.

### 9.4 Before production

Phil runs one test on testnet before the flag is turned on in production:

1. Sign in to the console in Testnet mode with an Arweave wallet.
2. Link a devnet Solana wallet holding a little devnet USDC and SOL.
3. On Top Up, pay 1 USDC on Solana with Buying For left on the Arweave wallet.
4. Confirm the credits land on the Arweave address, and that the Account page's payment history shows the row with the Solana sender.

This is the one link in § 6 that code cannot prove.

## 10. Rollout and rollback

- **Phase 1** ships through the usual `develop` → staging → `main` path. Rollback is a revert of one PR.
- **Phase 2** ships with the flag off in production. After § 9.4 passes, turning the flag on is a one-line change in its own PR. Rollback is turning it off.
- Nothing either phase does is written to storage in a way the other depends on, so the phases can be reverted independently.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| A cross-wallet payment is sent without a destination and strands credits | P1 is enforced in one helper that throws, and tested for every source and target pair |
| The settlement wait watches the wrong balance and times out after a successful payment | P6, and case 3 in § 8.4 |
| A same-wallet payment changes shape | P2: no destination when source equals target, tested |
| A 43-character Solana address used as a Buying For target is resolved as Arweave by the service | Pre-existing, and outside this change (the service's own documented caveat, `addressTypeResolutionOrder`). Worth a separate look. |
| The service misses a destination and credits the sender | For this change's new path, no: the service reads Solana memos robustly, both memo program versions and inner instructions included. For EVM it is a pre-existing gap, see § 11.1 |
| The dropdown hides the cheapest option | Preselection puts ARIO first on the name checkout, and the collapsed row shows its badge and price |
| Users do not understand which wallet pays | Rows grouped by wallet; the payer and target line on Top Up |

### 11.1 Where a destination can be missed

The Turbo backend confirmed on 2026-09-23 that a destination the service extracts always wins, and a malformed one is rejected rather than credited to the sender. The sender is credited only when a destination is on-chain but never extracted. The cases, by chain:

| Chain | Extracted when | Missed when |
| --- | --- | --- |
| Solana (SOL, ARIO, USDC) | Always: both memo program versions, inner instructions included | Not known to miss |
| Arweave | The tag is exactly `Turbo-Credit-Destination-Address` (case-sensitive) | Any other spelling |
| Native ETH, POL, Base ETH | The whole calldata is valid UTF-8 | The memo is mixed with binary data |
| USDC on Ethereum or Base | The memo bytes follow a direct `transfer(address,uint256)` call | Sent through a smart-contract wallet, a multicall or a batched send |
| Every chain | The memo reads `turboCreditDestinationAddress=ADDRESS` | A bare address |

The SDK writes the exact tag and the exact memo form, and a plain wallet sends a direct transfer, so every path this spec adds is on the robust Solana row.

**Smart-contract wallets are handled outside this change** (#124, in 4.10.0). They cannot give the plain signature Turbo's Ethereum signer recovers a key from, so they cannot upload or spend credits, and a destination memo in their payments is never read. That PR removes Base Account and Safe from the connect list, signs out any Ethereum session whose address has contract code on Ethereum, Base or Polygon (EIP-7702 delegations excepted), and blocks a Buying For payment from one as a last check.

Exchange withdrawals cannot carry a memo and always credit the sender; the backend saw one on 2026-09-23. The console never sends from an exchange, but manual recovery on Top Up accepts any transaction id. That screen must say, before submission, that a withdrawal from an exchange credits the exchange's address, not the user's.

## 12. Decisions on the open questions

Phil answered the open questions on 2026-09-23, as follows:

| Question | Decision | Where |
| --- | --- | --- |
| Offer ARIO for credit top-ups? | Yes, subtly: an ordinary row with a "Lower fee" tag | § 7.2 |
| Keep slow tokens on the name checkout? | Yes, with a two-step flow for long waits | § 7.8 |
| Show "Paid from" in payment history? | Yes. The service returns the sender for every crypto row | § 9.2 |
| SOL threshold for the USDC fee | The base signature fee, 5,000 lamports | § 7.9 |

### Answers from the Turbo backend

The Turbo backend answered on 2026-09-23. Each answer and where it lands in this spec:

| Question | Answer | Where |
| --- | --- | --- |
| Confirmations and time to credit, per token | Only AR is slow (p90 ~51 min); every other token credits within about 2.5 minutes at p90 | § 7.8 |
| Does ARIO get the 25% fee when crediting an Arweave or Ethereum address? | Yes. The fee is chosen from the payment token alone, before the destination is resolved. Proven by the live quote, not yet by a credited top-up | § 8.4, case 11 |
| Is the sender ever credited despite a destination? | Only when the destination is on-chain but not extracted. Solana is robust; ERC-20 through a smart-contract wallet is not | § 11.1 |
| Does payment history return the sender? | Yes, as `senderAddress`, for every row since about 2025-10-27; older rows return an empty string | § 9.2 |

"Recovered payments" in the question meant `PendingTxRecoveryBanner`, which resubmits by transaction id. The backend confirmed that any payment it credits, by submission or by its own discovery sweep, goes through the same crediting code and records the sender.
