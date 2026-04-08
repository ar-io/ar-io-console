import { type VerificationResult } from '../../services/verificationService';

interface Step {
  label: string;
  detail: string | null;
  status: 'complete' | 'partial' | 'unavailable';
}

function buildSteps(result: VerificationResult): Step[] {
  const steps: Step[] = [];

  steps.push({
    label: 'Signed',
    detail: result.authenticity.signatureValid ? 'Signature verified' : result.owner.address ? 'Owner identified' : 'Unknown',
    status: result.authenticity.signatureValid ? 'complete' : result.owner.address ? 'partial' : 'unavailable',
  });

  if (result.bundle.isBundled) {
    steps.push({ label: 'Bundled', detail: 'In a bundle', status: 'complete' });
  }

  steps.push({
    label: 'Confirmed',
    detail: result.existence.blockHeight ? `Block ${result.existence.blockHeight.toLocaleString()}` : result.existence.status === 'pending' ? 'Pending' : 'Not found',
    status: result.existence.status === 'confirmed' ? 'complete' : result.existence.status === 'pending' ? 'partial' : 'unavailable',
  });

  const hops = result.gatewayAssessment.hops;
  steps.push({
    label: 'Delivered',
    detail: hops !== null ? `${hops} hop${hops !== 1 ? 's' : ''}` : 'Gateway',
    status: hops !== null ? 'complete' : 'partial',
  });

  steps.push({
    label: 'Verified',
    detail: result.authenticity.status === 'signature_verified' ? 'Authentic' : result.authenticity.status === 'hash_verified' ? 'Hash match' : 'Unverified',
    status: result.authenticity.status === 'signature_verified' ? 'complete' : result.authenticity.status === 'hash_verified' ? 'partial' : 'unavailable',
  });

  return steps;
}

const DOT: Record<Step['status'], string> = {
  complete: 'bg-primary',
  partial: 'bg-primary/60',
  unavailable: 'bg-foreground/20',
};

const LINE: Record<Step['status'], string> = {
  complete: 'bg-primary',
  partial: 'bg-primary/30',
  unavailable: 'bg-foreground/10',
};

export default function ProvenanceChain({ result }: { result: VerificationResult }) {
  const steps = buildSteps(result);

  return (
    <div className="rounded-2xl border border-border/20 bg-card p-5">
      <h3 className="mb-4 text-sm font-medium text-foreground/50">Provenance chain</h3>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => (
          <div key={i} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              {i > 0 && <div className={`h-0.5 flex-1 ${LINE[step.status]}`} />}
              <div className={`relative z-10 h-3 w-3 shrink-0 rounded-full ${DOT[step.status]}`} />
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${LINE[steps[i + 1].status]}`} />}
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground/70">{step.label}</p>
            {step.detail && <p className="mt-0.5 text-[10px] leading-tight text-foreground/40">{step.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
