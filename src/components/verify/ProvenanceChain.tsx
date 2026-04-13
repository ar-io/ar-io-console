import { type VerificationResult } from '../../services/verificationService';
import {
  shortId,
  viewblockAddressUrl,
  viewblockBlockUrl,
  viewblockTxUrl,
  formatDate,
} from './utils';

type StepStatus = 'complete' | 'partial' | 'unavailable';

interface Step {
  label: string;
  detail: string;
  subdetail: string | null;
  href: string | null;
  status: StepStatus;
}

function buildSteps(result: VerificationResult): Step[] {
  const steps: Step[] = [];

  // Signed — who created this data
  const hasOwner = !!result.owner.address;
  const sigVerified = !!result.authenticity.signatureValid;
  steps.push({
    label: 'Signed',
    detail: hasOwner ? shortId(result.owner.address!, 6, 4) : 'Unknown',
    subdetail: sigVerified ? 'Signature \u2713' : hasOwner ? 'Signature unchecked' : null,
    href: hasOwner ? viewblockAddressUrl(result.owner.address!) : null,
    status: sigVerified ? 'complete' : hasOwner ? 'partial' : 'unavailable',
  });

  // Bundled — optional, only if data item is inside a bundle
  if (result.bundle.isBundled) {
    steps.push({
      label: 'Bundled',
      detail: 'Data item',
      subdetail: result.bundle.rootTransactionId
        ? `Root: ${shortId(result.bundle.rootTransactionId, 6, 4)}`
        : null,
      href: result.bundle.rootTransactionId
        ? viewblockTxUrl(result.bundle.rootTransactionId)
        : null,
      status: 'complete',
    });
  }

  // Stored — when it was anchored on Arweave
  const confirmed = result.existence.status === 'confirmed';
  const pending = result.existence.status === 'pending';
  steps.push({
    label: 'Stored',
    detail: result.existence.blockHeight !== null
      ? `Block ${result.existence.blockHeight.toLocaleString()}`
      : pending ? 'Pending' : 'Not found',
    subdetail: result.existence.blockTimestamp
      ? formatDate(result.existence.blockTimestamp)
      : pending ? 'Awaiting confirmation' : null,
    href: result.existence.blockHeight !== null
      ? viewblockBlockUrl(result.existence.blockHeight)
      : null,
    status: confirmed ? 'complete' : pending ? 'partial' : 'unavailable',
  });

  // Verified — the gateway's independent check (just now)
  const level = result.level;
  const gateway = result.attestation?.gateway ?? null;
  const operator = result.attestation?.operator ?? null;
  const depthLabel = level === 3 ? 'Sig + hash \u2713' : level === 2 ? 'Hash \u2713' : 'Pending';
  steps.push({
    label: 'Verified',
    detail: gateway ?? 'Your gateway',
    subdetail: depthLabel,
    href: operator ? viewblockAddressUrl(operator) : null,
    status: level >= 3 ? 'complete' : level >= 2 ? 'partial' : 'unavailable',
  });

  return steps;
}

const DOT: Record<StepStatus, string> = {
  complete: 'bg-primary',
  partial: 'bg-primary/60',
  unavailable: 'bg-foreground/20',
};

const LINE: Record<StepStatus, string> = {
  complete: 'bg-primary',
  partial: 'bg-primary/30',
  unavailable: 'bg-foreground/10',
};

export default function ProvenanceChain({ result }: { result: VerificationResult }) {
  const steps = buildSteps(result);

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-5">
      <h3 className="mb-3 text-sm font-medium text-foreground/50">Provenance</h3>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              {i > 0 && <div className={`h-0.5 flex-1 ${LINE[step.status]}`} />}
              <div className={`relative z-10 h-3 w-3 shrink-0 rounded-full ${DOT[step.status]}`} />
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${LINE[steps[i + 1].status]}`} />}
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground/70">{step.label}</p>
            {step.href ? (
              <a
                href={step.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 text-xs leading-tight text-foreground/50 hover:text-primary hover:underline"
              >
                {step.detail}
              </a>
            ) : (
              <p className="mt-0.5 text-xs leading-tight text-foreground/40">{step.detail}</p>
            )}
            {step.subdetail && (
              <p className="mt-0.5 text-xs leading-tight text-foreground/40">{step.subdetail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
