import { useEffect, useRef, useState } from 'react';
import { Check, ImageIcon, Loader2, Upload } from 'lucide-react';
import { ARIO_LOGO_TX_ID } from '@ar.io/sdk/solana';

import { useFileUpload } from '../../../hooks/useFileUpload';
import {
  useFreeStatus,
  useFreeUploadLimit,
} from '../../../hooks/useFreeUploadLimit';
import { useStore } from '../../../store/useStore';
import { isArweaveTxId } from '../utils';
import { IMAGE_ACCEPT, validateLogoFile } from '../logoUpload';
import { compressImage } from '../imageCompress';

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
  const [dragOver, setDragOver] = useState(false);
  // Object-URL preview of the just-picked file, shown instantly (and while the
  // upload runs) so there's never a blind moment before the gateway thumbnail.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const canUpload = !!address;

  // Set/clear the local file preview, always revoking the previous object URL.
  const setPreview = (url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  };

  // Revoke any live object URL on unmount.
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const handlePick = () => {
    if (disabled || status === 'uploading') return;
    fileInputRef.current?.click();
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    // Live preview of the selected file immediately (and during upload).
    setPreview(URL.createObjectURL(file));

    // Over the free tier? Try to compress it to fit before validating/uploading,
    // so an oversized logo still uploads for free. Small images pass through
    // untouched; a failed compress falls through to normal validation.
    let toUpload = file;
    if (freeUploadLimitBytes > 0 && file.size >= freeUploadLimitBytes) {
      try {
        toUpload = await compressImage(file, freeUploadLimitBytes - 1);
      } catch {
        toUpload = file;
      }
    }

    const validation = validateLogoFile(
      { name: toUpload.name, type: toUpload.type, size: toUpload.size },
      freeUploadLimitBytes,
      bytesRemaining,
    );
    if (!validation.ok) {
      setPreview(null);
      setStatus('error');
      setErrorMsg(validation.message);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('uploading');
    setProgress(0);
    try {
      const result = await uploadFile(toUpload, {
        onProgress: setProgress,
        signal: controller.signal,
      });
      const txId = (result as { id?: string })?.id;
      if (!txId) {
        throw new Error('Upload did not return a transaction ID.');
      }
      setPreviewFailed(false);
      // Fall back to the gateway thumbnail now that the txId exists.
      setPreview(null);
      onChange(txId);
      setStatus('idle');
      setProgress(0);
    } catch (err) {
      setPreview(null);
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

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file fires `onChange` again.
    e.target.value = '';
    if (file) void handleFile(file);
  };

  const dropEnabled = !disabled && canUpload && status !== 'uploading';

  const onDragOver = (e: React.DragEvent) => {
    if (!dropEnabled) return;
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!dropEnabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const showGatewayPreview =
    !previewUrl && isArweaveTxId(value) && !previewFailed;
  const isDefaultLogo = value === ARIO_LOGO_TX_ID;

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
        {/* Preview: the just-picked file (instant) or the current TX id's
            gateway thumbnail (both modes). */}
        {(previewUrl || showGatewayPreview) && (
          <div className="flex flex-shrink-0 flex-col items-center gap-1">
            <img
              src={previewUrl ?? `${arioGatewayUrl}/${value}`}
              alt="Logo preview"
              className="h-12 w-12 rounded object-contain"
              onError={previewUrl ? undefined : () => setPreviewFailed(true)}
            />
            {isDefaultLogo && !previewUrl && (
              <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-foreground/50">
                Default (AR.IO logo)
              </span>
            )}
          </div>
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
                onChange={onInputChange}
                disabled={disabled}
              />
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`rounded-2xl border border-dashed p-3 text-center transition-colors ${
                  dragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-border/30 bg-card/50'
                }`}
              >
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
                <p className="mt-2 text-xs text-foreground/50">
                  {dragOver
                    ? 'Drop to upload'
                    : 'or drag an image here — large images are compressed to upload free'}
                </p>
              </div>
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
