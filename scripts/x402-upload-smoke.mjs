#!/usr/bin/env node
/**
 * Devnet-only x402 upload smoke test — reproduces the 290MB production incident
 * shape (402 challenge -> paid retry -> long body stream) against the testnet
 * bundler on Base Sepolia, and times every phase so a failure lands on a
 * specific one instead of "the upload broke".
 *
 * Not shipped, not in CI. Sibling of scripts/arns-buy-smoke.mjs.
 *
 *   BASE_SEPOLIA_KEY=0x...   # funded with Sepolia USDC + a little ETH for gas
 *   SIZE_MB=290              # payload size; use 8 for a cheap shape check
 *   UPLOAD_URL=https://upload.services.ar-io.dev/v1
 *   ENDPOINT=signed          # 'signed' (canonical) | 'legacy' (/x402/data-item/signed)
 *   BODY=blob                # 'blob' (buffered, what a paying client uses) | 'stream'
 *   node scripts/x402-upload-smoke.mjs
 *
 * What it isolates, in order:
 *   1. quote      — does the 402 arrive, and off headers or after the body?
 *   2. authorize  — how long is the EIP-3009 authorization valid for?
 *   3. transfer   — how long does the paid body actually take on the wire?
 *   4. verdict    — status + body, and whether settle outlived the authorization.
 */
import { createData, ArweaveSigner } from '@dha-team/arbundles';
import Arweave from 'arweave';
import { wrapFetchWithPayment } from 'x402-fetch';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http as viemHttp } from 'viem';
import { baseSepolia } from 'viem/chains';

const UPLOAD_URL = process.env.UPLOAD_URL ?? 'https://upload.services.ar-io.dev/v1';
const SIZE_MB = Number(process.env.SIZE_MB ?? 8);
const BODY = process.env.BODY ?? 'blob';
const PATHS = { signed: '/x402/upload/signed', legacy: '/x402/data-item/signed' };
const endpoint = PATHS[process.env.ENDPOINT ?? 'signed'];
const url = UPLOAD_URL + endpoint;
const now = () => Number(process.hrtime.bigint() / 1000000n);
const ms = (t) => `${((now() - t) / 1000).toFixed(1)}s`;

const size = SIZE_MB * 1024 * 1024;
console.log(`x402 upload smoke — ${SIZE_MB}MB via ${endpoint}, body=${BODY}\n${url}\n`);

// ---- build a real signed ANS-104 data item -------------------------------
let t = now();
const jwk = await Arweave.init({}).wallets.generate();
const arSigner = new ArweaveSigner(jwk);
const item = createData(new Uint8Array(size), arSigner, {
  tags: [{ name: 'Content-Type', value: 'application/octet-stream' },
          { name: 'App-Feature', value: 'x402-smoke' }],
});
await item.sign(arSigner);
const raw = new Uint8Array(item.getRaw());
console.log(`[1/4] signed data item: ${raw.length} bytes (${ms(t)})`);

// ---- phase 1: the quote, unpaid -----------------------------------------
t = now();
const quoteRes = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/octet-stream' },
  body: new Blob([raw]),
});
const quoteMs = now() - t;
const quoteText = await quoteRes.text();
let quote; try { quote = JSON.parse(quoteText); } catch { /* not JSON */ }
console.log(`[2/4] quote: HTTP ${quoteRes.status} in ${quoteMs}ms`);
if (quoteRes.status !== 402) {
  console.log(`      unexpected: ${quoteText.slice(0, 300)}`);
  process.exit(1);
}
if (!quote?.accepts) {
  // A 402 whose body is a bare string kills x402-fetch at `accepts.map(...)`.
  console.log(`      !! 402 without an 'accepts' array: ${quoteText.slice(0, 200)}`);
  console.log(`      x402-fetch cannot parse this — it throws on accepts.map()`);
  process.exit(1);
}
const req = quote.accepts.find((a) => a.network === 'base-sepolia') ?? quote.accepts[0];
console.log(`      maxAmountRequired=${req.maxAmountRequired} network=${req.network}`);
console.log(`      maxTimeoutSeconds=${req.maxTimeoutSeconds ?? '(absent)'}`);
// Did it price off headers, or read the body first?
console.log(`      quote arrived in ${quoteMs}ms for a ${raw.length}B body →`,
  quoteMs < 1000 ? 'priced off headers (body not drained)' : 'may have drained the body');

const projectedTransferS = Number(process.env.PROJECTED_S ?? 0);
if (req.maxTimeoutSeconds && projectedTransferS > req.maxTimeoutSeconds) {
  console.log(`      !! projected transfer ${projectedTransferS}s exceeds authorization validity ` +
              `${req.maxTimeoutSeconds}s — settle will be attempted against an expired authorization`);
}

// ---- phase 2+3: the paid attempt ----------------------------------------
if (!process.env.BASE_SEPOLIA_KEY) {
  console.log('\n[3/4] no BASE_SEPOLIA_KEY set — stopping before the paid leg.');
  console.log('      Set it (funded with Sepolia USDC + ETH) to run the full E2E.');
  process.exit(0);
}
const account = privateKeyToAccount(process.env.BASE_SEPOLIA_KEY);
const wallet = createWalletClient({ account, chain: baseSepolia, transport: viemHttp() });
console.log(`\n[3/4] paying as ${account.address}`);

const body = BODY === 'stream'
  ? new ReadableStream({ start(c) { c.enqueue(raw); c.close(); } })
  : new Blob([raw]);
const init = { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body,
               ...(BODY === 'stream' ? { duplex: 'half' } : {}) };

const fetchWithPay = wrapFetchWithPayment(fetch, wallet, BigInt(50_000_000));
t = now();
try {
  const res = await fetchWithPay(url, init);
  const text = await res.text();
  const took = (now() - t) / 1000;
  console.log(`[4/4] paid attempt: HTTP ${res.status} after ${took.toFixed(1)}s`);
  console.log(`      ${text.slice(0, 400).replace(/\s+/g, ' ')}`);
  console.log(`      throughput: ${(raw.length / took / 1e6).toFixed(2)} MB/s`);
  if (res.status === 400) {
    console.log(`\n      *** reproduced the incident signature: 400 after a long paid stream ***`);
    console.log(`      Ask the bundler for this request's $request_length — if it equals`);
    console.log(`      ${raw.length}, the body arrived whole and the rejection is post-receipt.`);
  }
  if (res.ok) console.log(`\n      upload succeeded — no repro at this size.`);
} catch (e) {
  console.log(`[4/4] paid attempt THREW after ${ms(t)}: ${e.constructor.name}: ${e.message}`);
  if (/disturbed or locked/.test(e.message)) {
    console.log(`      → x402-fetch body-reuse bug (dist/cjs/index.js:59-68): a streamed`);
    console.log(`        body cannot be re-sent on the paid retry. Use BODY=blob to get past it.`);
  }
}
