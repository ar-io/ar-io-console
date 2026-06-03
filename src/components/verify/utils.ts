export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function contentLabel(ct: string | null): string {
  if (!ct) return 'data';
  if (ct.startsWith('image/'))
    return ct.replace('image/', '').toUpperCase() + ' image';
  if (ct.startsWith('video/'))
    return ct.replace('video/', '').toUpperCase() + ' video';
  if (ct === 'application/pdf') return 'PDF document';
  if (ct.startsWith('text/')) return 'text file';
  return 'file';
}

export function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Viewblock URLs ───────────────────────────────────────
const VIEWBLOCK_BASE = 'https://viewblock.io/arweave';
export const viewblockTxUrl = (txId: string) => `${VIEWBLOCK_BASE}/tx/${txId}`;
export const viewblockAddressUrl = (addr: string) => `${VIEWBLOCK_BASE}/address/${addr}`;
export const viewblockBlockUrl = (h: number) => `${VIEWBLOCK_BASE}/block/${h}`;

// ── Verify API URLs ──────────────────────────────────────
export const rawDataUrl = (verifyApiUrl: string, txId: string) =>
  `${verifyApiUrl}/raw/${txId}`;

// ── String helpers ───────────────────────────────────────
export function shortId(id: string, head = 12, tail = 6): string {
  return id.length > head + tail + 3
    ? `${id.substring(0, head)}...${id.substring(id.length - tail)}`
    : id;
}

// ── Download filename derivation ─────────────────────────
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/octet-stream': 'bin',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'application/xml': 'xml',
  'text/xml': 'xml',
};

function extensionForContentType(contentType: string | null): string | null {
  if (!contentType) return null;
  // Strip parameters like "; charset=utf-8"
  const base = contentType.split(';')[0].trim().toLowerCase();
  if (CONTENT_TYPE_EXTENSIONS[base]) return CONTENT_TYPE_EXTENSIONS[base];
  // Fall back to the subtype (e.g. "image/heic" → "heic")
  const subtype = base.split('/')[1];
  return subtype || null;
}

export function downloadFilename(txId: string, contentType: string | null): string {
  const ext = extensionForContentType(contentType);
  return ext ? `${txId}.${ext}` : txId;
}
