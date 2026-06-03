import { Check, Clock } from 'lucide-react';
import CopyButton from '../CopyButton';
import { type VerificationResult } from '../../services/verificationService';
import { shortId, viewblockAddressUrl } from './utils';

interface Props {
  authenticity: VerificationResult['authenticity'];
  owner: VerificationResult['owner'];
}

function OwnerRow({ owner }: { owner: VerificationResult['owner'] }) {
  if (!owner.address) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-foreground/40">
        {owner.addressVerified ? 'Signed by' : 'Owner'}
      </span>
      <a
        href={viewblockAddressUrl(owner.address)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-foreground/60 hover:text-primary hover:underline"
      >
        {shortId(owner.address, 12, 6)}
      </a>
      <CopyButton textToCopy={owner.address} />
    </div>
  );
}

export default function AuthenticitySection({ authenticity, owner }: Props) {
  return (
    <div className="flex flex-col rounded-2xl border border-border/20 bg-card p-5">
      <h3 className="mb-3 text-sm font-medium text-foreground/50">Is this data authentic?</h3>

      {authenticity.status === 'signature_verified' ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Check className="h-5 w-5 shrink-0 text-success mt-0.5" />
            <div>
              <p className="font-semibold text-success">Digital signature verified</p>
              <p className="text-xs text-success/80">
                This data is exactly what the owner signed. It has not been modified.
              </p>
            </div>
          </div>

          {authenticity.dataHash && (
            <details className="text-xs">
              <summary className="cursor-pointer text-foreground/30 hover:text-foreground/50">
                Technical details
              </summary>
              <div className="mt-2 space-y-1 rounded-xl bg-foreground/5 p-2 text-foreground/40">
                <p>Data fingerprint: <span className="font-mono">{authenticity.dataHash}</span></p>
                {owner.addressVerified && <p>Address derived from public key (SHA-256)</p>}
                <p>Verification: RSA-PSS digital signature</p>
              </div>
            </details>
          )}
        </div>
      ) : authenticity.status === 'hash_verified' ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Check className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div>
              <p className="font-semibold text-primary">Data fingerprint confirmed</p>
              <p className="text-xs text-primary/70">
                The data fingerprint was independently computed. Signature could not be checked.
              </p>
            </div>
          </div>

          {authenticity.signatureSkipReason && (
            <p className="text-xs text-foreground/40">{authenticity.signatureSkipReason}</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Clock className="h-5 w-5 shrink-0 text-foreground/30 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground/60">Not yet verified</p>
              <p className="text-xs text-foreground/40">
                {authenticity.signatureSkipReason?.includes('too large')
                  ? authenticity.signatureSkipReason
                  : 'The gateway is still indexing this data. Try re-verifying in a moment.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Owner — consistent across all auth states */}
      {owner.address && (
        <div className="mt-auto pt-4">
          <OwnerRow owner={owner} />
        </div>
      )}
    </div>
  );
}
