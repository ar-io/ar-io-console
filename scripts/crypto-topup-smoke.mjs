/**
 * SMOKE (fix/x402-upload-funding) — NOT shipping code.
 *
 * Proves ON THE WIRE the thing PR #86 fixes: that a crypto payment buys enough
 * credits to cover the upload it is paying for.
 *
 * A crypto upload is two transactions — buy credits, then spend them. base-usdc
 * used to size step one from a raw byte quote (`getTokenPriceForBytes`), which
 * prorates the 1 GiB price and so scales the flat per-data-item fee away to
 * nothing, while step two is billed that fee per item. The payment settled and
 * the upload it had just paid for was rejected for insufficient balance.
 *
 * This runs the same turbo-sdk call sequence the console makes — the base-usdc
 * `walletAdapter` client for `topUpWithTokens`, then a plain Ethereum signer for
 * the upload, exactly as `useFileUpload` does — and asserts:
 *
 *   1. the credits the top-up actually buys (balance delta, read from the
 *      service, not computed) cover what the upload is billed;
 *   2. the upload then SUCCEEDS and returns a data item id;
 *   3. the retired raw-byte quote would have been short for this same file.
 *
 * Costs real Base Sepolia USDC (a fraction of a cent at the default size).
 *
 *   BASE_SEPOLIA_KEY=0x...   funded with Sepolia USDC + a little ETH for gas
 *   SIZE_BYTES=1024          default; small files are where the bug was worst
 *   node scripts/crypto-topup-smoke.mjs
 */
import { TurboFactory } from '@ardrive/turbo-sdk';
import { EthereumSigner } from '@dha-team/arbundles';
import { ethers } from 'ethers';

const PAYMENT_URL = process.env.PAYMENT_URL ?? 'https://payment.services.ar-io.dev';
const UPLOAD_URL = process.env.UPLOAD_URL ?? 'https://upload.services.ar-io.dev';
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
/*
  Default sits ABOVE the bundler's free tier on purpose. Below it an upload
  returns `winc 0` and never touches credits, so it proves nothing about whether
  the payment covered anything. The script checks the live limit and refuses to
  run under it.
*/
const SIZE_BYTES = Number(process.env.SIZE_BYTES ?? 6 * 1024 * 1024);
const BUFFER_MULTIPLIER = 1.05; // matches the app
const WINC_PER_CREDIT = 1e12;
const GiB = 1024 ** 3;

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failures++; console.log(`  ✗ ${m}`); };
const done = () => {
  console.log(failures === 0 ? '\n[smoke] RESULT: PASS\n' : `\n[smoke] RESULT: FAIL — ${failures} check(s) failed\n`);
  process.exit(failures === 0 ? 0 : 1);
};

const key = process.env.BASE_SEPOLIA_KEY;

// Refuse to run a test the free tier would make meaningless.
const info = await (await fetch(`${UPLOAD_URL}/v1/info`)).json();
/*
  Take the LARGER of the two caps. On the devnet bundler these disagree —
  freeUploadLimitBytes=107520 while freeTier.maxItemBytes=5242880 — and the
  larger is the one that actually decides whether a single item is billed. An
  upload under it returns `winc 0` no matter what the smaller field says.
*/
const freeLimit = Math.max(
  Number(info.freeUploadLimitBytes ?? 0),
  Number(info.freeTier?.maxItemBytes ?? 0),
);
if (SIZE_BYTES <= freeLimit) {
  console.log(`\nSIZE_BYTES=${SIZE_BYTES} is within the bundler's free tier (${freeLimit}B).`);
  console.log('The upload would cost 0 winc and prove nothing. Use a larger SIZE_BYTES.\n');
  process.exit(2);
}

const paymentServiceConfig = { url: PAYMENT_URL };
const uploadServiceConfig = { url: UPLOAD_URL };
const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
const wallet = key ? new ethers.Wallet(key, provider) : null;
console.log(`\n[smoke] crypto top-up -> upload, ${SIZE_BYTES}B` +
  (wallet ? ` as ${wallet.address}` : ' (DRY RUN — pricing only, nothing spent)'));
console.log(`        payment=${PAYMENT_URL} upload=${UPLOAD_URL}\n`);

// ---- 1. price the upload exactly the way the app does -------------------
const pricing = TurboFactory.unauthenticated({ token: 'base-usdc', paymentServiceConfig });
const rates = await pricing.getFiatRates();
const perItemFee = Number(rates.perDataItemFeeWinc ?? 0);
const wincPerGiBBilled = Number((await pricing.getUploadCosts({ bytes: [GiB] }))[0].winc);
const tokensPerGiB = Number((await pricing.getTokenPriceForBytes({ byteCount: GiB })).tokenPrice);

// UploadPanel's totalCost: storage + the per-data-item fee, per file.
const billedWinc = (SIZE_BYTES / GiB) * Number(rates.winc) + perItemFee;
const credits = billedWinc / WINC_PER_CREDIT;

// The fix: credits -> tokens, with the safety buffer (jitPayment.tokenPricePerCredit).
const rate = tokensPerGiB / (wincPerGiBBilled / WINC_PER_CREDIT);
const payUSDC = credits * rate * BUFFER_MULTIPLIER;
const payMUSDC = Math.ceil(payUSDC * 1e6);

// The bug: raw byte quote, no per-item fee, no buffer.
const oldUSDC = Number(((tokensPerGiB / GiB) * SIZE_BYTES).toFixed(6));

console.log(`1. pricing`);
console.log(`   upload is billed   ${billedWinc.toFixed(0)} winc (${credits.toFixed(9)} credits)`);
console.log(`   this PR pays       ${payUSDC.toFixed(6)} USDC (${payMUSDC} mUSDC)`);
console.log(`   old quote would be ${oldUSDC.toFixed(6)} USDC`);
if (oldUSDC < payUSDC) ok(`old quote is ${((1 - oldUSDC / payUSDC) * 100).toFixed(1)}% lower — the under-funding this fixes`);
else bad('old quote was not lower; the bug does not reproduce at this size');

if (!wallet) {
  console.log('\n   Pricing verified. The paying legs need a funded key:');
  console.log('   fund a throwaway wallet with Base Sepolia USDC (faucet.circle.com)');
  console.log('   plus a little Sepolia ETH for gas, then re-run with');
  console.log('     BASE_SEPOLIA_KEY=0x... node scripts/crypto-topup-smoke.mjs');
  done();
}

// ---- 2. top up, and measure what the service actually credited ----------
/*
  gatewayUrl is REQUIRED here, not optional. The SDK picks the USDC contract by
  substring-matching this URL for 'sepolia'/'amoy' (common/token/usdc.js); with
  it absent it silently defaults to the Base MAINNET contract. On Sepolia that
  address holds no code, so the transfer succeeds as a bare call that moves
  nothing — ~22k gas, status 1, zero tokens sent, no error anywhere. The console
  gets this right because useEthereumTurboClient always passes
  `gatewayUrl: config.tokenMap[tokenType]`.
*/
const payer = TurboFactory.authenticated({
  token: 'base-usdc',
  walletAdapter: { getSigner: () => wallet },   // same shape useEthereumTurboClient uses
  gatewayUrl: BASE_SEPOLIA_RPC,
  paymentServiceConfig, uploadServiceConfig,
});
/*
  Balances are read by ADDRESS against an unauthenticated client, not off the
  payer. `getBalance()` with no argument derives the address via
  `signer.getNativeAddress()`, which the node build cannot do for a
  walletAdapter-backed client (it reaches for a publicKey the adapter has no
  reason to carry) and throws before any payment is attempted. The address is
  the same either way, so read it directly.
*/
const balances = TurboFactory.unauthenticated({ token: 'base-usdc', paymentServiceConfig });
const readWinc = async () =>
  Number((await balances.getBalance(wallet.address)).effectiveBalance ?? 0);
const before = await readWinc();
console.log(`\n2. paying ${payMUSDC} mUSDC (balance before: ${before} winc)`);
let topUpStatus;
try {
  const r = await payer.topUpWithTokens({ tokenAmount: BigInt(payMUSDC) });
  topUpStatus = r?.status;
  ok(`topUpWithTokens settled (status: ${topUpStatus})`);
} catch (e) {
  bad(`topUpWithTokens failed: ${e?.message ?? e}`);
  done();
}
/*
  Poll rather than read once. `topUpWithTokens` resolves when the payment
  service accepts the transaction, which is a moment BEFORE the balance
  reflects it; reading immediately reports 0 and looks like a failed payment.
  Worth noting the app has the same shape — it dispatches 'refresh-balance'
  the instant the top-up returns.
*/
const SETTLE_TIMEOUT_MS = Number(process.env.SETTLE_TIMEOUT_MS ?? 420_000);
const settleStart = Date.now();
let after = before;
while (after <= before && Date.now() - settleStart < SETTLE_TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 3000));
  after = await readWinc();
}
const settleMs = Date.now() - settleStart;
const credited = after - before;
console.log(`   balance reflected the payment after ~${Math.round(settleMs / 1000)}s`);
if (after > before && settleMs > 30_000) {
  console.log(`   NOTE: 'confirmed' did not mean spendable for ${Math.round(settleMs / 1000)}s.`);
  console.log(`   useFileUpload uploads as soon as topUpWithTokens resolves, so a`);
  console.log(`   correctly-sized payment can still hit insufficient balance.`);
}
console.log(`   credited ${credited} winc (balance now ${after})`);
if (credited >= billedWinc) {
  ok(`credited covers the ${billedWinc.toFixed(0)} winc bill (${(credited / billedWinc * 100).toFixed(1)}%)`);
} else {
  bad(`credited ${credited} < ${billedWinc.toFixed(0)} billed — payment still under-funds the upload`);
}

// ---- 3. spend them: the upload must actually land -----------------------
console.log(`\n3. uploading ${SIZE_BYTES}B against those credits`);
const uploader = TurboFactory.authenticated({
  signer: new EthereumSigner(key),              // same identity, ordinary credit-billed upload
  paymentServiceConfig, uploadServiceConfig,
});
try {
  /*
    Unique per run. An identical payload signs to an identical data item id,
    which Turbo already has — it returns that id and charges 0 winc. That reads
    exactly like a free-tier upload and would quietly stop this from testing
    anything on a second run.
  */
  const data = Buffer.alloc(SIZE_BYTES);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const res = await uploader.uploadFile({
    fileStreamFactory: () => data,
    fileSizeFactory: () => data.length,
    dataItemOpts: { tags: [
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'App-Feature', value: 'crypto-topup-smoke' },
      { name: 'Smoke-Run', value: nonce },
    ]},
  });
  if (!res?.id) {
    bad(`upload returned no id: ${JSON.stringify(res).slice(0, 200)}`);
  } else if (Number(res.winc ?? 0) <= 0) {
    // Free-tier upload: it landed, but it never touched the credits we bought,
    // so it says nothing about whether the payment covered the bill.
    bad(`upload accepted (${res.id}) but cost 0 winc — free tier or dedup, proves nothing`);
  } else {
    ok(`upload accepted: ${res.id}, charged ${res.winc} winc against the credits just bought`);
  }
} catch (e) {
  const msg = e?.message ?? String(e);
  if (/insufficient|balance|402/i.test(msg)) {
    bad(`upload REJECTED for balance after a settled payment — the incident: ${msg}`);
  } else {
    bad(`upload failed: ${msg}`);
  }
}

done();
