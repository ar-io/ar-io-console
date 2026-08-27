/**
 * Hosts that serve this app as plain static files.
 *
 * They can return index.html and the bundle, and nothing else — ask one of
 * them for `/{txId}` and you get a 404, because there is no gateway behind
 * them resolving Arweave transactions.
 */
const STATIC_ONLY_HOSTS = [
  'github.io',
  'vercel.app',
  'netlify.app',
  'pages.dev',
];

/**
 * Can the host this app is served from resolve an Arweave transaction id?
 *
 * The old rule was "localhost can't, everything else can", which read the
 * absence of a dev hostname as proof of a gateway. That held only while the
 * app was served from an ar.io gateway or a local dev server. Put it on
 * GitHub Pages and every txId URL — ArNS profile logos most visibly — became
 * `https://ar-io.github.io/{txId}` and 404'd.
 *
 * False here means "fall back to the configured AR.IO gateway", which is
 * always a safe answer: a real gateway can serve the transaction whatever the
 * app is hosted on. The failure this prevents is silent and looks like broken
 * images rather than a misconfiguration, so the default leans that way.
 */
export function hostServesArweave(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;

  return !STATIC_ONLY_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}
