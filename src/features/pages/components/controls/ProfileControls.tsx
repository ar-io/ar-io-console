import { useRef, useState } from 'react';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';
import type { ControlProps } from './types';
import { TextAreaField, TextField } from './primitives';
import { downscaleImageToDataUrl, estimateDataUrlBytes } from '../imageResize';
import { isArUrl, resolveArUrl } from '../../render/arResolve';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Whether an avatar value is an image reference (vs. plain initials text). */
function isImageRef(value: string | undefined): boolean {
  if (!value) return false;
  return value.startsWith('data:') || isArUrl(value) || /^https?:\/\//i.test(value);
}

export default function ProfileControls({ def, update, ctx }: ControlProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = def.profile;
  const avatar = profile.avatar;
  const avatarSrc = isImageRef(avatar) ? resolveArUrl(avatar as string, ctx) : '';

  const setProfile = (patch: Partial<typeof profile>) =>
    update((d) => ({ ...d, profile: { ...d.profile, ...patch } }));

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await downscaleImageToDataUrl(file, { maxDim: 512, quality: 0.85 });
      setProfile({ avatar: dataUrl });
    } catch (e) {
      console.error('Avatar processing failed:', e);
      setError(e instanceof Error ? e.message : 'Could not process that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/20 bg-primary/10">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="font-heading text-lg font-bold text-primary">
              {initialsOf(profile.displayName)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
              {avatarSrc ? 'Replace' : 'Upload avatar'}
            </button>
            {isImageRef(avatar) && (
              <button
                type="button"
                onClick={() => setProfile({ avatar: undefined })}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-background px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:text-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-foreground/50">
            {avatar && avatar.startsWith('data:')
              ? `Optimized to ${(estimateDataUrlBytes(avatar) / 1024).toFixed(0)} KB · resized to ≤512px`
              : 'PNG/JPG/WebP — resized to ≤512px. Falls back to initials.'}
          </p>
          {error && <p className="mt-1 text-xs text-error">{error}</p>}
        </div>
      </div>

      <TextField
        label="Display name"
        value={profile.displayName}
        onChange={(v) => setProfile({ displayName: v })}
        placeholder="Your name"
        maxLength={80}
      />
      <TextField
        label="Tagline"
        value={profile.tagline ?? ''}
        onChange={(v) => setProfile({ tagline: v })}
        placeholder="What you do, in a line"
        maxLength={140}
      />
      <TextAreaField
        label="Bio"
        value={profile.bio ?? ''}
        onChange={(v) => setProfile({ bio: v })}
        placeholder="A short introduction"
        maxLength={400}
        rows={3}
      />
    </div>
  );
}
