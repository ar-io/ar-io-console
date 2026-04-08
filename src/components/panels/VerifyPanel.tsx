import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  Loader2,
  ExternalLink,
  Check,
  AlertCircle,
  ArrowLeft,
  Upload,
} from 'lucide-react';
import { useVerification } from '../../hooks/useVerification';
import { useStore } from '../../store/useStore';
import CopyButton from '../CopyButton';
import VerifyHero from '../verify/VerifyHero';
import AuthenticitySection from '../verify/AuthenticitySection';
import ProvenanceChain from '../verify/ProvenanceChain';
import { formatBytes, relativeTime, bufferToBase64Url } from '../verify/utils';

const TX_ID_PATTERN = /^[a-zA-Z0-9_-]{43}$/;

const EXAMPLES = [
  { txId: 'WkaBoAfqfW2P4K2NO1SBDwhVsKQJSVTVEnaDvjoyZzA', label: 'PDF' },
  { txId: '0T8mUqgnSnVY2hdUA8FV3uaWPe1QUcgcOiqdsDWCQII', label: 'JPEG' },
  { txId: 'Yh10aRkLW0s5yJX4X6-DO1T6JYkLtslWBIOHAFziSzs', label: 'PNG' },
  { txId: 'mltyfIZ-mD3Lc50Y_QfdaJ7SM6aBKquG0ORfQ3dEb0Q', label: 'Video' },
];

export default function VerifyPanel() {
  const [txId, setTxId] = useState('');
  const { verify, result, isVerifying, elapsed, error, reset, txParam } =
    useVerification();

  // File compare state
  const [compareResult, setCompareResult] = useState<{
    fileName: string;
    fileHash: string;
    match: boolean;
  } | null>(null);
  const [hashing, setHashing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Deep link — run once on mount if ?tx= is present
  const deepLinkRan = useRef(false);
  useEffect(() => {
    if (!deepLinkRan.current && txParam && TX_ID_PATTERN.test(txParam)) {
      deepLinkRan.current = true;
      setTxId(txParam);
      verify(txParam);
    }
  }, [txParam, verify]);

  const [inputError, setInputError] = useState<string | null>(null);

  const handleVerify = () => {
    const trimmed = txId.trim();
    setInputError(null);
    if (!trimmed) {
      setInputError('Please enter a transaction ID.');
      return;
    }
    if (!TX_ID_PATTERN.test(trimmed)) {
      setInputError('Invalid format. Transaction IDs are 43 base64url characters.');
      return;
    }
    verify(trimmed);
  };

  const handleReverify = () => {
    if (result) verify(result.txId);
  };

  const handleBack = () => {
    reset();
    setCompareResult(null);
    setTxId('');
  };

  // File comparison
  const handleFileDrop = useCallback(
    async (file: File) => {
      if (!result?.authenticity.dataHash) return;
      setHashing(true);
      setCompareResult(null);
      try {
        const buf = await file.arrayBuffer();
        const hashBuf = await crypto.subtle.digest('SHA-256', buf);
        const fileHash = bufferToBase64Url(hashBuf);
        setCompareResult({
          fileName: file.name,
          fileHash,
          match: fileHash === result.authenticity.dataHash,
        });
      } finally {
        setHashing(false);
      }
    },
    [result]
  );

  const { getCurrentConfig } = useStore();

  // ── Report view ──
  if (result) {
    const dataHash = result.authenticity.dataHash;

    return (
      <div className="px-4 sm:px-6">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Verify another
        </button>

        <div className="space-y-6">
          <VerifyHero
            result={result}
            onReverify={handleReverify}
            reverifying={isVerifying}
          />
          <ProvenanceChain result={result} />

          {/* Verification evidence */}
          <div>
            <h3 className="mb-3 font-heading text-base font-bold text-foreground/70">
              Verification evidence
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <AuthenticitySection
                authenticity={result.authenticity}
                owner={result.owner}
              />

              {/* Existence card */}
              <div className="rounded-2xl border border-border/20 bg-card p-5">
                <h3 className="mb-3 text-sm font-medium text-foreground/50">
                  Is this data on Arweave?
                </h3>
                <div className="flex items-center gap-2">
                  {result.existence.status === 'confirmed' ? (
                    <Check className="h-6 w-6 text-success" />
                  ) : result.existence.status === 'pending' ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-error" />
                  )}
                  <div>
                    <p
                      className={`font-semibold ${result.existence.status === 'confirmed' ? 'text-success' : result.existence.status === 'pending' ? 'text-primary/70' : 'text-error'}`}
                    >
                      {result.existence.status === 'confirmed'
                        ? 'Confirmed'
                        : result.existence.status === 'pending'
                          ? 'Pending'
                          : 'Not Found'}
                    </p>
                    {result.existence.blockHeight && (
                      <a
                        href={`https://viewblock.io/arweave/block/${result.existence.blockHeight}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Block {result.existence.blockHeight.toLocaleString()}
                      </a>
                    )}
                  </div>
                </div>
                {result.existence.blockTimestamp && (
                  <p className="mt-2 text-xs text-foreground/50">
                    {new Date(result.existence.blockTimestamp).toUTCString()}
                    <span className="ml-1 text-foreground/30">
                      ({relativeTime(result.existence.blockTimestamp)})
                    </span>
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1 text-xs">
                  <span className="font-mono text-foreground/50">
                    {result.txId.substring(0, 12)}...
                    {result.txId.substring(result.txId.length - 6)}
                  </span>
                  <CopyButton textToCopy={result.txId} />
                  <a
                    href={`https://viewblock.io/arweave/tx/${result.txId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Bundle card */}
              {result.bundle.isBundled && (
                <div className="rounded-2xl border border-border/20 bg-card p-5">
                  <h3 className="mb-3 text-sm font-medium text-foreground/50">
                    Bundle
                  </h3>
                  <p className="text-sm text-foreground/70">
                    This is a bundled data item. Its signature and integrity are
                    verified independently. The bundle anchors it to the
                    blockchain.
                  </p>
                  {result.bundle.rootTransactionId && (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <span className="text-foreground/40">Root TX:</span>
                      <span className="font-mono text-foreground/50">
                        {result.bundle.rootTransactionId.substring(0, 12)}...
                      </span>
                      <CopyButton
                        textToCopy={result.bundle.rootTransactionId}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Image preview */}
          {result.metadata.contentType?.startsWith('image/') && (
            <div>
              <h3 className="mb-3 font-heading text-base font-bold text-foreground/70">
                Data preview
              </h3>
              <div className="rounded-2xl border border-border/20 bg-card p-4 overflow-hidden">
                <img
                  src={`${getCurrentConfig().verifyApiUrl}/raw/${result.txId}`}
                  alt={`Verified: ${result.txId.substring(0, 8)}...`}
                  className="max-h-64 w-full rounded-xl object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}

          {/* File comparison */}
          {dataHash && (
            <div>
              <h3 className="mb-3 font-heading text-base font-bold text-foreground/70">
                Compare local file
              </h3>
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : hashing
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border/20 bg-card'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileDrop(file);
                }}
              >
                {hashing ? (
                  <div className="flex items-center gap-2 text-sm text-foreground/50">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Computing SHA-256...
                  </div>
                ) : compareResult ? (
                  <div className="w-full space-y-2 text-center">
                    <p className="text-sm text-foreground/60">
                      {compareResult.fileName}
                    </p>
                    {compareResult.match ? (
                      <div className="flex items-center justify-center gap-1.5 text-success">
                        <Check className="h-5 w-5" />
                        <span className="font-semibold">
                          Hash match confirmed
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 text-error">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-semibold">Hash mismatch</span>
                      </div>
                    )}
                    <p className="font-mono text-xs text-foreground/30">
                      File: {compareResult.fileHash}
                    </p>
                    <p className="font-mono text-xs text-foreground/30">
                      On-chain: {dataHash}
                    </p>
                    <button
                      onClick={() => setCompareResult(null)}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      Compare another file
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-2 h-8 w-8 text-foreground/20" />
                    <p className="text-sm text-foreground/50">
                      Drop a file to check if it matches the stored version
                    </p>
                    <label className="mt-2 cursor-pointer text-xs text-primary hover:underline">
                      or choose a file
                      <input
                        type="file"
                        className="hidden"
                        aria-label="Select file to compare"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileDrop(file);
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Details & gateway signals */}
          <div>
            <h3 className="mb-3 font-heading text-base font-bold text-foreground/70">
              Details
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/20 bg-card p-5">
                <h3 className="mb-3 text-sm font-medium text-foreground/50">
                  Metadata
                </h3>
                {result.metadata.dataSize !== null && (
                  <p className="text-sm text-foreground/70">
                    <span className="font-medium">Size:</span>{' '}
                    {formatBytes(result.metadata.dataSize)}
                  </p>
                )}
                {result.metadata.contentType && (
                  <p className="text-sm text-foreground/70">
                    <span className="font-medium">Type:</span>{' '}
                    {result.metadata.contentType}
                  </p>
                )}
                {result.metadata.tags.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-primary hover:underline">
                      {result.metadata.tags.length} tag
                      {result.metadata.tags.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="mt-2 max-h-48 overflow-auto rounded-2xl bg-background p-2">
                      {result.metadata.tags.map((tag, i) => (
                        <div key={`${tag.name}-${i}`} className="flex gap-2 py-0.5 text-xs">
                          <span className="font-medium text-foreground/60">
                            {tag.name}:
                          </span>
                          <span className="break-all text-foreground/40">
                            {tag.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {/* Gateway signals — always show in console (users are technical) */}
              {(result.gatewayAssessment.trusted !== null ||
                result.gatewayAssessment.hops !== null) && (
                <div className="rounded-2xl border border-border/20 bg-card p-5">
                  <h3 className="mb-3 text-sm font-medium text-foreground/50">
                    Gateway signals
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.gatewayAssessment.trusted !== null && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${result.gatewayAssessment.trusted ? 'border-success/20 bg-success/10 text-success' : 'border-border/20 bg-foreground/5 text-foreground/40'}`}
                      >
                        {result.gatewayAssessment.trusted && (
                          <Check className="mr-1 inline h-3 w-3" />
                        )}
                        Trusted source
                      </span>
                    )}
                    {result.gatewayAssessment.hops !== null && (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {result.gatewayAssessment.hops} hop
                        {result.gatewayAssessment.hops !== 1 ? 's' : ''}
                      </span>
                    )}
                    {result.gatewayAssessment.verified !== null && (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${result.gatewayAssessment.verified ? 'border-success/20 bg-success/10 text-success' : 'border-border/20 bg-foreground/5 text-foreground/40'}`}
                      >
                        Gateway{' '}
                        {result.gatewayAssessment.verified
                          ? 'verified'
                          : 'processing'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/20 pt-4">
            <p className="text-xs text-foreground/30">
              {result.verificationId}
            </p>
            <a
              href={`https://viewblock.io/arweave/tx/${result.txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View on Viewblock
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Input view ──
  return (
    <div className="px-4 sm:px-6">
      {/* Panel header — matches console pattern */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-border/20 bg-primary/20 mt-1">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-heading text-2xl font-bold text-foreground mb-1">
            Verify Data
          </h3>
          <p className="text-sm text-foreground/80">
            Cryptographic proof of existence, integrity, and authorship.
            Independently verified by your ar.io gateway.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="txId"
            className="mb-1.5 block text-sm font-medium text-foreground/70"
          >
            Transaction ID
          </label>
          <input
            id="txId"
            type="text"
            value={txId}
            onChange={(e) => { setTxId(e.target.value); setInputError(null); }}
            onKeyDown={(e) =>
              e.key === 'Enter' && !isVerifying && handleVerify()
            }
            placeholder="Enter a 43-character Arweave transaction ID"
            className="w-full rounded-2xl border border-border/20 bg-card px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none"
            disabled={isVerifying}
          />
        </div>

        {(error || inputError) && (
          <div className="flex items-center gap-2 rounded-2xl bg-error/10 border border-error/20 p-3 text-sm text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error || inputError}
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={isVerifying || !txId.trim()}
          className="w-full rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVerifying ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            'Verify'
          )}
        </button>

        {/* Progress */}
        {isVerifying && elapsed > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {elapsed < 5
                ? 'Locating and verifying...'
                : elapsed < 15
                  ? 'Downloading and hashing raw data...'
                  : 'Waiting for gateway to index...'}
            </div>
            {elapsed >= 8 && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/5">
                <div
                  className="h-full rounded-full bg-primary/40 transition-all duration-1000"
                  style={{
                    width: `${Math.min((elapsed / 30) * 100, 95)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Examples */}
        {!isVerifying && (
          <div className="border-t border-border/20 pt-4">
            <p className="mb-2.5 text-xs font-medium text-foreground/40">
              Try an example
            </p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.txId}
                  onClick={() => {
                    setTxId(ex.txId);
                    verify(ex.txId);
                  }}
                  className="rounded-full border border-border/20 bg-card px-3 py-1.5 text-xs font-medium text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
