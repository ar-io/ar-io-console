/**
 * SMOKE (fix/x402-upload-funding) — NOT shipping code.
 *
 * Probes the bundler's x402 upload surface from console's own dependency tree,
 * against the devnet bundler. Written after a production incident where a 290MB
 * x402 upload settled payment and then failed, and exists to keep the two causes
 * from regressing silently:
 *
 *   1. SIZE CEILING — the single-request x402 endpoint rejects data items over
 *      10485760 bytes with HTTP 400 "Data item is too large".
 *
 *      This used to mean x402 above 10 MiB had NO path to succeed: the chunked
 *      uploader was disabled whenever funding was x402, because the bundler
 *      could not charge for a multipart upload. That is no longer true — the
 *      bundler settles at create as of turbo-sdk 1.43.0-alpha.5, so chunking IS
 *      the path above the ceiling. The ceiling itself still stands and still
 *      applies to this single-request endpoint, which is what this checks.
 *
 *      Note the service's own words on the streamed case below: chunked or
 *      streamed bodies "cannot be priced up front". Chunked x402 works through
 *      the multipart create/settle route, not by streaming one request.
 *   2. PAY-THEN-REJECT ORDER — the incident cost real money because the size
 *      check ran AFTER the 402 challenge, so the client paid for an upload that
 *      could never be accepted. This asserts an oversized item is refused for
 *      free, at the challenge, before any payment is possible. That is the
 *      regression test for the bundler-side fix.
 *
 * Also records `maxTimeoutSeconds`, the validity window of the payment
 * authorization: it is flat regardless of size, so a transfer slower than the
 * window settles against an expired authorization.
 *
 * Run (devnet only): node scripts/x402-upload-smoke.mjs
 *   UPLOAD_URL=https://upload.services.ar-io.dev/v1  override the bundler
 */
import { createData, ArweaveSigner } from '@dha-team/arbundles';
import Arweave from 'arweave';

const UPLOAD_URL = process.env.UPLOAD_URL ?? 'https://upload.services.ar-io.dev/v1';
const SIGNED = `${UPLOAD_URL}/x402/upload/signed`;
const MAX_ITEM_BYTES = 10 * 1024 * 1024; // the ceiling the service enforces
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 60_000);

/** fetch with a deadline, so a stalled bundler fails the check instead of hanging it. */
async function fetchWithDeadline(url, init) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal });
    return { res, text: await res.text() };
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new Error(`no response within ${TIMEOUT_MS}ms`);
    }
    throw e;
  }
}

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  failures++;
  console.log(`  ✗ ${m}`);
};

const jwk = await Arweave.init({}).wallets.generate();
const signer = new ArweaveSigner(jwk);

/** Sign a real ANS-104 item of roughly `payloadBytes` and POST it unpaid. */
async function post(payloadBytes) {
  const item = createData(new Uint8Array(payloadBytes), signer, {
    tags: [{ name: 'Content-Type', value: 'application/octet-stream' }],
  });
  await item.sign(signer);
  const raw = new Uint8Array(item.getRaw());
  const started = Date.now();
  const { res, text } = await fetchWithDeadline(SIGNED, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: new Blob([raw]),
  });
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { itemBytes: raw.length, status: res.status, body, ms: Date.now() - started };
}

console.log(`\n[smoke] x402 upload surface @ ${SIGNED}\n`);

console.log('1. an item under the ceiling is quoted for payment');
try {
  const r = await post(MAX_ITEM_BYTES - 64 * 1024);
  if (r.status === 402) {
    ok(`${r.itemBytes}B item -> 402 challenge in ${r.ms}ms`);
    const accepts = r.body?.accepts;
    if (Array.isArray(accepts) && accepts.length > 0) {
      ok('402 carries an `accepts` array (x402-fetch parses this)');
      const req = accepts.find((a) => /base/.test(a.network)) ?? accepts[0];
      console.log(`    maxAmountRequired=${req.maxAmountRequired} network=${req.network}`);
      console.log(`    maxTimeoutSeconds=${req.maxTimeoutSeconds ?? '(absent)'} ` +
                  `— authorization validity, flat regardless of upload size`);
    } else {
      // A 402 whose body is a bare string kills x402-fetch at `accepts.map(...)`.
      bad(`402 without an 'accepts' array; x402-fetch would throw: ${JSON.stringify(r.body).slice(0, 120)}`);
    }
  } else {
    bad(`expected 402, got ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
  }
} catch (e) { bad(`under-ceiling probe failed: ${e.message}`); }

console.log('\n2. an item over the ceiling is refused, and refused for FREE');
try {
  const r = await post(MAX_ITEM_BYTES + 64 * 1024);
  if (r.status === 402) {
    bad(`${r.itemBytes}B item was QUOTED FOR PAYMENT (402) despite exceeding ` +
        `${MAX_ITEM_BYTES}B — this is the incident: the buyer pays, then the ` +
        `upload is rejected as too large and the money is gone`);
  } else if (r.status === 400 && /too large/i.test(String(r.body))) {
    ok(`${r.itemBytes}B item -> 400 too-large at the challenge, before payment (${r.ms}ms)`);
  } else {
    bad(`expected a free 400 'too large', got ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
  }
} catch (e) { bad(`over-ceiling probe failed: ${e.message}`); }

console.log('\n3. the incident shape: oversized AND streamed, so no Content-Length');
try {
  // The production failure arrived without a Content-Length (chunked transfer
  // encoding), so the service could not size it up front. That is the path where
  // the 402 was issued first and the buyer paid for an upload that could not be
  // accepted. A streamed body also cannot be re-sent on x402-fetch's paid retry
  // (it throws 'body disturbed or locked'), so this shape is doubly broken.
  const item = createData(new Uint8Array(MAX_ITEM_BYTES * 3), signer, {
    tags: [{ name: 'Content-Type', value: 'application/octet-stream' }],
  });
  await item.sign(signer);
  const raw = new Uint8Array(item.getRaw());
  const started = Date.now();
  const { res, text } = await fetchWithDeadline(SIGNED, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    duplex: 'half',
    body: new ReadableStream({
      start(c) {
        let off = 0;
        const step = 256 * 1024;
        (function push() {
          if (off >= raw.length) return c.close();
          c.enqueue(raw.slice(off, off + step));
          off += step;
          setTimeout(push, 0);
        })();
      },
    }),
  });
  const ms = Date.now() - started;
  /*
    The property is REFUSED BEFORE PAYMENT, not a particular status code.

    This asserted 400 'too large' specifically, and started failing when the
    service began answering 411 — "x402 uploads require a Content-Length header.
    Chunked/streamed bodies cannot be priced up front" — which refuses the same
    request, for free, at the same point, with a better reason. Pinning the code
    turned an improvement into a red build.

    402 is the only real failure: being asked to pay for a request that cannot
    succeed is the incident this script exists for.
  */
  if (res.status === 402) {
    bad(`${raw.length}B streamed item was QUOTED FOR PAYMENT (402) — the exact ` +
        `production incident: pay first, rejected as too large after the body lands`);
  } else if (res.status >= 400 && res.status < 500) {
    ok(`${raw.length}B streamed item -> ${res.status}, unpaid (${ms}ms): ${text.slice(0, 90)}`);
  } else {
    bad(`expected an unpaid 4xx refusal, got ${res.status}: ${text.slice(0, 160)}`);
  }
} catch (e) { bad(`streamed probe failed: ${e.message}`); }

console.log(
  failures === 0
    ? '\n[smoke] RESULT: PASS\n'
    : `\n[smoke] RESULT: FAIL — ${failures} check(s) failed\n`,
);
process.exit(failures === 0 ? 0 : 1);
