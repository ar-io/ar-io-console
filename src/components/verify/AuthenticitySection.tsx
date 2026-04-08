import { Check, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import CopyButton from '../CopyButton';
import { type VerificationResult } from '../../services/verificationService';

interface Props {
  authenticity: VerificationResult['authenticity'];
  owner: VerificationResult['owner'];
}

export default function AuthenticitySection({ authenticity, owner }: Props) {
  return (
    <div className="rounded-2xl border border-border/20 bg-card p-5 md:col-span-2">
      <h3 className="mb-4 text-sm font-medium text-foreground/50">Is this data authentic?</h3>

      {authenticity.status === 'signature_verified' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-success" />
            <div>
              <p className="font-semibold text-success">Digital signature verified</p>
              <p className="text-xs text-success/80">
                This data is exactly what the owner signed. It has not been modified.
              </p>
            </div>
          </div>

          {owner.address && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground/40">Signed by</span>
              <span className="font-mono text-foreground/60">
                {owner.address.substring(0, 12)}...{owner.address.substring(owner.address.length - 6)}
              </span>
              <CopyButton textToCopy={owner.address} />
              <a
                href={`https://viewblock.io/arweave/address/${owner.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {authenticity.dataHash && (
            <details className="text-xs">
              <summary className="cursor-pointer text-foreground/30 hover:text-foreground/50">
                Technical details
              </summary>
              <div className="mt-2 space-y-1 rounded-lg bg-background p-2 text-foreground/40">
                <p>Data fingerprint: <span className="font-mono">{authenticity.dataHash}</span></p>
                {owner.addressVerified && <p>Address derived from public key (SHA-256)</p>}
                <p>Verification: RSA-PSS digital signature</p>
              </div>
            </details>
          )}
        </div>
      ) : authenticity.status === 'hash_verified' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
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

          {owner.address && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-foreground/40">Owner</span>
              <span className="font-mono text-foreground/60">
                {owner.address.substring(0, 12)}...{owner.address.substring(owner.address.length - 6)}
              </span>
              <CopyButton textToCopy={owner.address} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-foreground/30" />
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
    </div>
  );
}
