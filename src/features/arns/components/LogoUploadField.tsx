import { useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, Upload } from 'lucide-react';

import { useFileUpload } from '../../../hooks/useFileUpload';
import {
  useFreeStatus,
  useFreeUploadLimit,
} from '../../../hooks/useFreeUploadLimit';
import { useStore } from '../../../store/useStore';
import { isArweaveTxId } from '../utils';
import { IMAGE_ACCEPT, validateLogoFile } from '../logoUpload';

const inputCls =
  'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary focus:outline-none disabled:opacity-50';

interface LogoUploadFieldProps {
  value: string;
  onChange: (txid: string) => void;
  disabled?: boolean;
  /** Prefix for input `id`/`htmlFor` uniqueness across multiple rows. */
  idPrefix: string;
  label: string;
}

type Mode = 'upload' | 'paste';
type Status = 'idle' | 'uploading' | 'error';

/**
 * Reusable logo input that toggles between UPLOAD (pick an image → upload via
 * the console's existing Turbo path → the resulting TX ID populates the field)
 * and PASTE TX ID (the original 43-char input, kept as a fallback). Uploads reuse
 * `useFileUpload().uploadFile`, so signing works across whichever wallet backs
 * the session (Arweave / Ethereum / Solana) — no new signing logic. Images are
 * constrained to the bundler free tier, so a logo upload costs nothing.
 *
 * Wired into the ANT-level logo (EditDetailsModal) and record logos
 * (RecordFieldsEditor); the toggle markup mirrors RecordFieldsEditor's
 * Arweave/IPFS segmented control so the controls feel identical.
 */
export default function LogoUploadField({
  value,
  onChange,
  disabled,
  idPrefix,
  label,
}: LogoUploadFieldProps) {
  const { uploadFile } = useFileUpload();
  const { freeUploadLimitBytes } = useFreeUploadLimit();
  const { bytesRemaining } = useFreeStatus();
  const address = useStore((s) => s.address);
  const arioGatewayUrl = useStore(
    (s) => s.getCurrentConfig().arioGatewayUrl,
  );

  const [mode, setMode] = useState<Mode>('paste');
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canUpload = !!address;

  const handlePick = () => {
    if (disabled || status === 'uploading') return;
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file fires `onChange` again.
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    const validation = validateLogoFile(
      { name: file.name, type: file.type, size: file.size },
      freeUploadLimitBytes,
      bytesRemaining,
    );
    if (!validation.ok) {
      setStatus('error');
      setErrorMsg(validation.message);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('uploading');
    setProgress(0);
    try {
      const result = await uploadFile(file, {
        onProgress: setProgress,
        signal: controller.signal,
      });
      const txId = (result as { id?: string })?.id;
      if (!txId) {
        throw new Error('Upload did not return a transaction ID.');
      }
      setPreviewFailed(false);
      onChange(txId);
      setStatus('idle');
      setProgress(0);
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Upload failed. Try again or paste a TX ID instead.',
      );
    } finally {
      abortRef.current = null;
    }
  };

  const showPreview = isArweaveTxId(value) && !previewFailed;

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{label}</span>

      {/* Upload / Paste toggle (mirrors RecordFieldsEditor's protocol toggle) */}
      <div className="mb-3 inline-flex rounded-full border border-border/20 bg-card p-1">
        {(
          [
            { m: 'upload' as Mode, label: 'Upload' },
            { m: 'paste' as Mode, label: 'Paste TX ID' },
          ]
        ).map(({ m, label: tLabel }) => {
          const isActive = mode === m;
          const toggleDisabled = disabled || (m === 'upload' && !canUpload);
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setStatus('idle');
                setErrorMsg(null);
              }}
              disabled={toggleDisabled}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              {tLabel}
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3">
        {/* Thumbnail preview of the current TX id (both modes). */}
        {showPreview && (
          <img
            src={`${arioGatewayUrl}/${value}`}
            alt="Logo preview"
            className="h-12 w-12 flex-shrink-0 rounded object-contain"
            onError={() => setPreviewFailed(true)}
          />
        )}

        <div className="min-w-0 flex-1">
          {mode === 'paste' ? (
            <input
              id={`${idPrefix}-txid`}
              className={`${inputCls} font-mono`}
              value={value}
              onChange={(e) => {
                setPreviewFailed(false);
                onChange(e.target.value);
              }}
              placeholder="43-character transaction ID"
              spellCheck={false}
              disabled={disabled}
            />
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={handleFile}
                disabled={disabled}
              />
              <button
                type="button"
                onClick={handlePick}
                disabled={disabled || status === 'uploading'}
                className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'uploading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading… {progress}%
                  </>
                ) : isArweaveTxId(value) ? (
                  <>
                    <Check className="h-4 w-4 text-primary" />
                    Choose a different image
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4" />
                    Choose image
                  </>
                )}
              </button>
              {isArweaveTxId(value) && status !== 'uploading' && (
                <p className="mt-1 truncate font-mono text-xs text-foreground/60">
                  {value}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Show whenever signed out — the Upload toggle is disabled in that state,
          so gating on `mode === 'upload'` would make this hint unreachable. */}
      {!canUpload && (
        <p className="mt-2 flex items-center gap-1 text-xs text-foreground/60">
          <Upload className="h-3 w-3" />
          Connect a wallet to upload, or paste an existing TX ID.
        </p>
      )}

      {status === 'error' && errorMsg && (
        <div className="mt-2 rounded-2xl border border-error/20 bg-error/10 p-3 text-xs text-error">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
