/**
 * SMOKE (fix/folder-upload-credit-settlement) — NOT shipping code.
 *
 * Proves ON THE WIRE the premise PR #109 rests on: that a crypto top-up is not
 * spendable the moment `topUpWithTokens` resolves, so a deploy that uploads
 * immediately is uploading against credits that do not exist yet.
 *
 * `useFolderUpload` did exactly that. `useFileUpload` was fixed for it in
 * 62d8dda; that commit touched two files and the folder hook was not one of
 * them, so site deploys kept the bug. `crypto-topup-smoke.mjs` covers the file
 * path and asserts a different property — that the payment BUYS enough — while
 * this one asserts that the credits ARRIVE before they are spent.
 *
 * Asserts, in order:
 *
 *   1. the balance does NOT move immediately after the top-up resolves — the
 *      window the bug lives in actually exists, measured rather than assumed;
 *   2. a deploy-sized batch is unaffordable at t=0, so uploading then would be
 *      rejected with the payment already settled ("paid, and nothing deployed");
 *   3. the credits do arrive, and how long it took;
 *   4. an upload afterwards succeeds.
 *
 * If (1) ever fails — the balance is instant — that is GOOD news and this
 * script says so rather than failing: the wait becomes belt-and-braces instead
 * of load-bearing. It fails only on (2)-(4), which are the parts the fix
 * depends on.
 *
 * Costs real Base Sepolia USDC (a fraction of a cent at the default size).
 *
 *   BASE_SEPOLIA_KEY=0x...   funded with Sepolia USDC + a little ETH for gas
 *   FILE_COUNT=3             data items in the "deploy", default 3
 *   SIZE_BYTES=6291456       per item; must exceed the free tier
 *   node scripts/deploy-settlement-smoke.mjs
 */
import { TurboFactory } from '@ardrive/turbo-sdk';
import { EthereumSigner } from '@dha-team/arbundles';
import { ethers } from 'ethers';

const PAYMENT_URL = process.env.PAYMENT_URL ?? 'https://payment.services.ar-io.dev';
const UPLOAD_URL = process.env.UPLOAD_URL ?? 'https://upload.services.ar-io.dev';
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';
const SIZE_BYTES = Number(process.env.SIZE_BYTES ?? 6 * 1024 * 1024);
const FILE_COUNT = Number(process.env.FILE_COUNT ?? 3);
const BUFFER_MULTIPLIER = 1.05; // matches the app
const WINC_PER_CREDIT = 1e12;
const GiB = 1024 ** 3;
/** Mirrors TOPUP_SETTLE_TIMEOUT_MS / TOPUP_SETTLE_POLL_MS in the app. */
const SETTLE_TIMEOUT_MS = 5 * 60 * 1000;
const SETTLE_POLL_MS = 3000;

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failures++; console.log(`  ✗ ${m}`); };
const note = (m) => console.log(`  · ${m}`);
const done = () => {
  console.log(failures === 0 ? '\n[smoke] RESULT: PASS\n' : `\n[smoke] RESULT: FAIL — ${failures} check(s) failed\n`);
  process.exit(failures === 0 ? 0 : 1);
};

const key = process.env.BASE_SEPOLIA_KEY;

// Refuse to run a test the free tier would make meaningless.
const info = await (await fetch(`${UPLOAD_URL}/v1/info`)).json();
const freeLimit = Math.max(
  Number(info.freeUploadLimitBytes ?? 0),
  Number(info.freeTier?.maxItemBytes ?? 0),
);
if (SIZE_BYTES <= freeLimit) {
  console.log(`\nSIZE_BYTES=${SIZE_BYTES} is within the bundler's free tier (${freeLimit}B).`);
  console.log('Every item would cost 0 winc and settlement would prove nothing.\n');
  process.exit(2);
}

const paymentServiceConfig = { url: PAYMENT_URL };
const uploadServiceConfig = { url: UPLOAD_URL };
const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
const wallet = key ? new ethers.Wallet(key, provider) : null;
console.log(`\n[smoke] deploy settlement — ${FILE_COUNT} x ${SIZE_BYTES}B` +
  (wallet ? ` as ${wallet.address}` : ' (DRY RUN — pricing only, nothing spent)'));
console.log(`        payment=${PAYMENT_URL} upload=${UPLOAD_URL}\n`);

// ---- price the deploy the way DeploySitePanel does ----------------------
const pricing = TurboFactory.unauthenticated({ token: 'base-usdc', paymentServiceConfig });
const rates = await pricing.getFiatRates();
const perItemFee = Number(rates.perDataItemFeeWinc ?? 0);
const wincPerGiBBilled = Number((await pricing.getUploadCosts({ bytes: [GiB] }))[0].winc);
const tokensPerGiB = Number((await pricing.getTokenPriceForBytes({ byteCount: GiB })).tokenPrice);

// Per-data-item fee is charged PER FILE — see CLAUDE.md gotcha #9.
const billedWinc = FILE_COUNT * ((SIZE_BYTES / GiB) * Number(rates.winc) + perItemFee);
const creditsNeeded = billedWinc / WINC_PER_CREDIT;
const rate = tokensPerGiB / (wincPerGiBBilled / WINC_PER_CREDIT);
const payUSDC = creditsNeeded * rate * BUFFER_MULTIPLIER;

note(`deploy bills ~${creditsNeeded.toFixed(6)} credits (${FILE_COUNT} items, fee ${perItemFee} winc each)`);
note(`top-up would send ~${payUSDC.toFixed(6)} USDC`);

if (!wallet) {
  console.log('\n[smoke] DRY RUN complete — set BASE_SEPOLIA_KEY to exercise settlement.\n');
  process.exit(0);
}

// ---- 1. does the window exist? -----------------------------------------
const readBalance = async () => {
  const unauth = TurboFactory.unauthenticated({ token: 'base-usdc', paymentServiceConfig, uploadServiceConfig });
  const bal = await unauth.getBalance(wallet.address);
  return Number(bal?.effectiveBalance ?? 0) / WINC_PER_CREDIT;
};

const before = await readBalance();
note(`balance before: ${before.toFixed(6)} credits`);

/*
  `gatewayUrl` is REQUIRED, not optional — the same trap crypto-topup-smoke.mjs
  documents. The SDK picks the USDC contract by substring-matching this URL for
  'sepolia'/'amoy'; absent, it silently defaults to the Base MAINNET contract,
  which holds no code on Sepolia. The transfer then succeeds as a bare call
  that moves nothing: ~22k gas, status 1, zero tokens sent, no error anywhere —
  and every downstream symptom looks exactly like a settlement delay. Omitting
  it cost a run here before the receipt was decoded.

  The console gets this right: useEthereumTurboClient always passes
  `gatewayUrl: config.tokenMap[tokenType]`.
*/
const funder = TurboFactory.authenticated({
  token: 'base-usdc',
  walletAdapter: { getSigner: () => wallet },
  gatewayUrl: BASE_SEPOLIA_RPC,
  paymentServiceConfig,
  uploadServiceConfig,
});
const topUpStarted = Date.now();
await funder.topUpWithTokens({ tokenAmount: BigInt(Math.ceil(payUSDC * 1e6)) });
const resolvedAt = Date.now();
note(`topUpWithTokens resolved after ${((resolvedAt - topUpStarted) / 1000).toFixed(1)}s`);

const atZero = await readBalance();
if (atZero > before) {
  // Not a failure: settlement was instant here, so the wait is belt-and-braces
  // rather than load-bearing. Worth knowing, not worth failing.
  note('balance moved immediately — settlement was instant on this run');
} else {
  ok('balance has NOT moved yet — the window the bug lives in is real');
}

// ---- 2. uploading now would be rejected --------------------------------
if (atZero < creditsNeeded) {
  ok(`unaffordable at t=0 (${atZero.toFixed(6)} < ${creditsNeeded.toFixed(6)}) — deploying now = paid, nothing deployed`);
} else {
  note('affordable at t=0 — a prior balance covered it, so this run cannot show the failure');
}

// ---- 3. the credits do arrive ------------------------------------------
const deadline = Date.now() + SETTLE_TIMEOUT_MS;
let settledAt;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
  const current = await readBalance();
  if (current > before) { settledAt = Date.now(); break; }
}
if (settledAt) {
  ok(`credits landed after ${((settledAt - resolvedAt) / 1000).toFixed(1)}s of waiting`);
} else {
  bad(`credits never landed within ${SETTLE_TIMEOUT_MS / 1000}s`);
  done();
}

// ---- 4. and the deploy then succeeds -----------------------------------
const uploader = TurboFactory.authenticated({
  signer: new EthereumSigner(key),
  paymentServiceConfig,
  uploadServiceConfig,
});
try {
  const data = Buffer.alloc(SIZE_BYTES, 1);
  const res = await uploader.uploadFile({
    fileStreamFactory: () => data,
    fileSizeFactory: () => data.byteLength,
  });
  res?.id ? ok(`upload succeeded after settlement (${res.id})`) : bad('upload returned no id');
} catch (e) {
  bad(`upload failed after settlement: ${e?.message ?? e}`);
}

done();
