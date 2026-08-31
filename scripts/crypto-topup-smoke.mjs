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
const SIZE_BYTES = Number(process.env.SIZE_BYTES ?? 1024);
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
const payer = TurboFactory.authenticated({
  token: 'base-usdc',
  walletAdapter: { getSigner: () => wallet },   // same shape useEthereumTurboClient uses
  paymentServiceConfig, uploadServiceConfig,
});
const before = Number((await payer.getBalance()).effectiveBalance ?? 0);
console.log(`\n2. paying ${payMUSDC} mUSDC (balance before: ${before} winc)`);
try {
  await payer.topUpWithTokens({ tokenAmount: BigInt(payMUSDC) });
  ok('topUpWithTokens settled');
} catch (e) {
  bad(`topUpWithTokens failed: ${e?.message ?? e}`);
  done();
}
const after = Number((await payer.getBalance()).effectiveBalance ?? 0);
const credited = after - before;
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
  const data = Buffer.alloc(SIZE_BYTES);
  const res = await uploader.uploadFile({
    fileStreamFactory: () => data,
    fileSizeFactory: () => data.length,
    dataItemOpts: { tags: [
      { name: 'Content-Type', value: 'application/octet-stream' },
      { name: 'App-Feature', value: 'crypto-topup-smoke' },
    ]},
  });
  if (res?.id) ok(`upload accepted: ${res.id} (winc ${res.winc})`);
  else bad(`upload returned no id: ${JSON.stringify(res).slice(0, 200)}`);
} catch (e) {
  const msg = e?.message ?? String(e);
  if (/insufficient|balance|402/i.test(msg)) {
    bad(`upload REJECTED for balance after a settled payment — the incident: ${msg}`);
  } else {
    bad(`upload failed: ${msg}`);
  }
}

done();
