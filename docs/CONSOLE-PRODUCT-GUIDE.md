# ar.io Console product guide

This guide describes what ar.io Console does and how each part behaves, as of
4.11.0 and the Unreleased changes in the changelog. It is for anyone who supports, sells, documents or builds on
the Console and needs the product's behaviour in one place. For how the code
is organised, see [`CLAUDE.md`](../CLAUDE.md). For what changed in each
release, see [`CHANGELOG.md`](../CHANGELOG.md), which the app also shows at
`/changelog`.

## Contents

1. [Overview](#overview)
2. [Signing in](#signing-in)
3. [Credits](#credits)
4. [Uploading, deploying and capturing](#uploading-deploying-and-capturing)
5. [Pages](#pages)
6. [ArNS names](#arns-names)
7. [Browse](#browse)
8. [Account](#account)
9. [Settings and networks](#settings-and-networks)
10. [Design rules](#design-rules)
11. [Routes](#routes)
12. [Troubleshooting](#troubleshooting)

## Overview

The Console is the ar.io web app for storing data permanently on Arweave and
giving it a name. In one place you can:

- Buy Turbo credits by card or with crypto, and share them with other wallets.
- Upload files and folders, deploy a static site, or capture a web page.
- Build a link-in-bio page with Pages and publish it.
- Register, renew and manage ArNS names, and point them at your content.
- Browse permaweb content, with optional verification.

Credits are issued by Turbo, an ar.io gateway run by the ArDrive team. They
never expire, and they pay for storage, ArNS names and changes to names.

## Signing in

Choose a sign-in method from **Connect wallet** in the header.

| Method | Identity | Notes |
| --- | --- | --- |
| Email (Privy) | An embedded Ethereum wallet, which holds your credits, plus an embedded Solana wallet for ArNS | No extension needed. The Solana wallet lets an email user own and manage ArNS names. |
| Wander | Arweave wallet | Uploads and payments in AR. |
| Ethereum wallets | MetaMask, Coinbase, WalletConnect and others | The app switches the wallet to the right network before a payment. Smart-contract wallets such as Base Account and Safe are not offered, and are signed out if detected. |
| Solana wallets | Phantom, Solflare, the Solana account in MetaMask, and any other wallet that registers through the Wallet Standard | The Solana account in MetaMask is a different address from MetaMask on Ethereum, with its own credits. |

### Linked Solana wallet

ArNS runs on Solana, so owning or changing a name needs a Solana wallet to
sign. If you sign in with Wander or an Ethereum wallet, you can link a Solana
wallet for ArNS without changing who you are signed in as. The linked wallet is
remembered, and reconnects on the pages that use it.

Credits are held by the account you signed in with, never by the linked
Solana wallet. A name is owned by
the Solana wallet: your own on a Solana session, or the linked one otherwise.

### Wallet capabilities

| Feature | Arweave | Ethereum | Solana |
| --- | --- | --- | --- |
| Buy credits by card | Yes | Yes | Yes |
| Buy credits with crypto | AR | USDC on Base, ETH on Base, USDC, POL, ETH | SOL, USDC on Solana, ARIO |
| Upload, deploy, capture | Yes | Yes | Yes |
| Pay at upload time | No | ETH on Base, USDC on Base | SOL, USDC on Solana |
| Share credits | Yes | Yes | Yes |
| Own and manage ArNS names | Through a linked Solana wallet | Through a linked Solana wallet (email accounts have one built in) | Yes |

## Credits

### Buy credits

Open **Buy Credits** (`/topup`) and choose **Card** or **Crypto**.

- **Card** goes through Stripe. Amounts run from $5 to $10,000.
- **Crypto** offers every token your wallet can pay with in one dropdown,
  with your balance and the price beside each. A token you can't use stays
  listed with the reason.
- **ARIO** is offered when you sign in with a Solana wallet (not to a linked
  Solana wallet). Each ARIO top-up is limited to $100 at the day's ARIO rate,
  and the preset amounts start at 1,000 ARIO.
- **Buying for** lets a full-page top-up credit another wallet. Inside a name
  purchase this option is hidden, and credits go to the account you signed in
  with.

Fees are Turbo's and come with each price quote, so they can differ by token
and can change. **Settings** shows the card infrastructure fee.

AR payments take longer to confirm: usually about 40 minutes, and sometimes
close to an hour. Other tokens usually credit within a few minutes. If you close the tab during a crypto
payment, **Have a transaction ID? Recover credits manually** on Buy Credits
lets you submit the transaction ID again.

### Share credits

**Share** (`/share`) lets another wallet spend some of your credits. You can
set an expiry, and revoke a share at any time from your Account page.

## Uploading, deploying and capturing

Each item you store costs storage plus a small per-item fee. Files under the
free-tier size are free; the free limit and any lifetime allowance show on the
upload screen. **Try It Out** (`/try`) is an upload that needs no wallet: it
signs you in by email when you upload.

There are three ways to pay:

1. **From your credits.** Works with every wallet.
2. **At upload time.** No credits needed in advance: the app sends crypto as
   part of the upload. Available with SOL, USDC on Solana, ETH on Base and USDC
   on Base. You set a maximum amount and a buffer.
3. **x402 (USDC on Base).** For x402-only bundlers. See
   [x402-only mode](#x402-only-mode).

### Upload

Drop files or a folder on **Upload** (`/upload`). A folder is stored with a
manifest so its paths resolve. When a single file finishes, a result card shows
its permanent link. **Recent uploads** keeps your history in this browser, with
**Export CSV**, **Check Status** and **Clear History**.

### Deploy a site

**Deploy** (`/deploy`) publishes a static site folder with a manifest. **Smart
Deploy** skips files that were already uploaded, by content hash, so a
redeploy uploads only what changed. Your deploys are listed at
`/deployments`.

### Capture a web page

**Capture** (`/capture`) takes a screenshot of a URL and stores it
permanently.

### Point a name at what you stored

You can point an ArNS name you own or control at what you stored. Deploy and
Capture can set a name during the flow; all three can set one afterwards from
the result or the history. When it
succeeds, the message names the address, such as `blog_yourname.ar.io`, and
offers **Visit** and **Manage yourname**. For an owner this change is paid in
credits.

## Pages

**Pages** (`/pages`) builds a link-in-bio page from a template. You edit your
profile, links and theme with a live preview, then publish a single
self-contained page to Arweave, optionally on an ArNS name. A page published
with a name is reachable at the name and, when it fits the free tier, shares a
generated preview image.
Earlier versions stay listed, and any of them can be made live again.

## ArNS names

ArNS names are human-readable names for Arweave content, such as
`yourname.ar.io`. Names live on Solana: each name is held by a token (an ANT)
in a Solana wallet.

### Find and buy a name

- **Domains** (`/domains`) lists every registered name, with search.
- **Register** (`/arns`) checks a name and buys it.
- **Pricing** (`/pricing?type=domains`) shows the price table.

At checkout you choose a lease (1 to 5 years) or a permanent purchase. You can
then choose what the name points at: the default, one of your recent deploys,
pages or uploads, or a transaction ID you paste. Last, you choose one of three
ways to pay:

| Method | What happens |
| --- | --- |
| **Credits** | Turbo pays the Solana costs and bills your credits. No SOL needed. |
| **Card** | You pay by card. That buys credits (at least $5; anything over the price stays on your balance), and the name is then bought from them with one wallet approval. |
| **Crypto** | Every token except ARIO buys credits first, and the name is bought from them: two wallet approvals, with the amount worked out for you. |

**ARIO** is one of the Crypto options, and works differently: the Solana wallet
that will own the name pays the registry directly, with no Turbo
infrastructure fee. That wallet pays the Solana costs too, so it needs some SOL,
and the option says how much when the wallet is short. ARIO is the only route
where your wallet pays the Solana costs of the purchase; with credits, a card
or another token, Turbo pays them.

Gateway operators get a 20% discount when paying with ARIO, if the gateway has
been joined for at least 180 days and passed at least 90% of epochs. A
gateway's operations wallet qualifies only on gateway schema 1.2.0. The
discount never applies to primary names.

Every method needs a Solana wallet to own the name. Signing in with email
creates one.

If a credit, card or token purchase doesn't finish, for example because you
closed the wallet prompt or approved too late, **Manage Domains** shows what
happened to it and when its credits return. The notice shows only in the
browser the purchase started in, for 30 minutes, and offers **Try again** once
the credits are back. ARIO purchases don't use this notice.

### Manage a name

**Manage Domains** (`/my-domains`) lists the names your wallet owns or
controls, with search, sorting, expiry warnings, **Export CSV** and **Register
a name**. Open a name to reach its page at `/domains/<name>`.

On a name's page, each action sits in the header of the section it changes:

| Section | Actions | Who |
| --- | --- | --- |
| Header | **Visit**, **Set as primary** | Owner only (the program requires the record owner to set it) |
| Overview | **Renew or upgrade** (lease), or **Add undername slots** (permanent) | Owner or controller |
| Details | **Edit** the name's own details | Owner or controller |
| Ownership | **Transfer**, **Reassign**, and **Release** (permanent names only) | Owner only |
| Controllers | **Manage** | Owner only |
| Records | **Add record**, and edit or remove each record | Owner or controller |

Each record name links to what it serves: `yourname.ar.io` for the root (`@`)
and `blog_yourname.ar.io` for an undername. The `@` record can be changed but
not removed; undernames can be removed. A record change shows as soon as it is
saved; the page then confirms it against the chain with a few reads.

### Who pays for a change

On a name's page, an owner's record, transfer and controller changes can be
paid two ways:

- **With your wallet's SOL.** If the signing wallet holds enough SOL, it signs
  the transaction and pays the Solana fee itself. This is the default, because
  the network fee is usually a fraction of a cent. **Pay with credits instead**
  switches to credits for that change. A record change needs 0.002 SOL to
  qualify; a transfer or adding a controller needs 0.005 SOL, because they can
  create accounts on chain.
- **With credits.** Turbo pays the Solana fee and bills credits. A wallet with
  no SOL, such as a new email account, always uses this.

A controller's changes are never sponsored: Turbo accepts only the owner's
signature, so a controller's wallet always signs and pays the Solana fee
itself. A record that points at an IPFS address, or sets a priority, is also
always signed and paid by your wallet, so it needs SOL.

Pointing a name at an upload, deploy, capture or page from those screens uses
credits for an owner; the SOL default applies on the name's page.

Renewing, upgrading and adding undername slots settle from credits with no
wallet approval, or by card, crypto or ARIO. In this Manage window a card pays
in one step at the exact price, and a crypto payment goes straight to the
confirmation because the amount is already known.

Some actions are never sponsored, so the wallet that signs them pays:

- **Edit details** (the name's own details, not a record's) costs SOL. A
  controller can do this, paying from their own wallet.
- **Reassign** and **Release** cost SOL. Owner only.
- **Set as primary** costs SOL and an ARIO fee from the wallet. Owner only.
- Buying a returned name costs ARIO and SOL.

Changes paid in credits show their price before you confirm; the actions above
say that your wallet pays a Solana fee, but not how much.

### Returned names

**Returned names** (`/returned-names`) lists names returned to the registry,
expired or released, during their return auction. Buying one is paid in ARIO, needs SOL for a new name token, and takes
two wallet approvals.

## Browse

**Browse** (`/browse`) opens permaweb content by ArNS name or transaction ID.
With verification on, a service worker checks the content against trusted
ar.io gateways (by hash by default, or by signature) and shows a verification
badge.

## Account

**Account** (`/account`) shows:

- Your signed-in wallet, and the linked Solana wallet with **Reconnect**,
  **Change** and **Unlink**.
- Your credit balance and free upload allowance, with **Top Up**.
- Payment history, with **Export CSV**.
- Credits you have shared, with revoke.

**Balances** (`/balances`) checks the credit balance of any address.

## Settings and networks

**Settings** (`/settings`) shows the gateway and Turbo services the app uses,
the storage rate, the infrastructure fee and the free tier, plus developer
resources.

The app runs on one of three configurations:

| Mode | Use |
| --- | --- |
| Production | Mainnet services. |
| Testnet | Testnet and Solana devnet services. The header shows **TESTNET MODE**. Names open on the testnet gateway (`ar-io.dev`). |
| Custom | Your own service URLs. |

### x402-only mode

For bundlers that accept only x402 payments. Turn it on in **Settings**. In
this mode only USDC on Base is offered, only Ethereum wallets can make paid
uploads, and credit purchases are unavailable. Names can still be bought with
ARIO, which pays the registry directly.

## Design rules

The Console follows the ar.io brand kit. Each screen has one purple primary
button; secondary actions are outlined; destructive actions are red. The small
buttons beside a section or list title share one small outlined style with an
icon: red for actions that delete or give something away, and purple for the
one main action in a header.
The rules and helpers are in [`docs/STYLE_GUIDE.md`](STYLE_GUIDE.md).

## Routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/try` | Try It Out, a quick free upload |
| `/topup` | Buy Credits |
| `/upload` | Upload |
| `/deploy`, `/deployments` | Deploy a site, and your deploys |
| `/capture` | Capture a web page |
| `/pages` | Pages |
| `/share` | Share credits |
| `/account`, `/balances` | Account, and balance lookup |
| `/domains`, `/domains/<name>` | All names, and one name's page |
| `/my-domains` | Manage Domains (your names) |
| `/arns` | Register a name (accepts `?q=`) |
| `/returned-names` | Returned name auctions |
| `/pricing` | Storage and name pricing (`?type=domains` for names) |
| `/browse` | Browse |
| `/settings` | Settings |
| `/changelog` | What's new |

`/calculator`, `/name-prices` and `/services-calculator` redirect to
`/pricing`. `/login` shows the home page. Unknown routes go to the home page.

## Troubleshooting

**"Wallet not available for direct payment", or a Pay button that reads
"Reconnect wallet to pay".** Your Solana wallet is locked or disconnected.
Reconnect it from that button and pay again.

**A name I bought doesn't show yet.** Purchases appear on Manage Domains within
a few seconds. If one doesn't, check for the incomplete-purchase notice there.

**I paid with crypto but my credits haven't arrived.** AR usually takes about
40 minutes, and sometimes close to an hour. For other tokens, use the recovery option on Buy Credits with your
transaction ID.

**My Solana wallet's address is different from my MetaMask address.** The
Solana account in MetaMask is its own address, with its own credits.

**A testnet name won't open.** Testnet names resolve on `ar-io.dev`, not
`ar.io`.
