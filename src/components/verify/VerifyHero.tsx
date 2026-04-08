import { Check, Clock, ShieldCheck, Share2 } from 'lucide-react';
import { useState } from 'react';
import { type VerificationResult, getPdfUrl } from '../../services/verificationService';
import { useStore } from '../../store/useStore';
import { relativeTime, formatBytes, formatDate, contentLabel } from './utils';

interface Props {
  result: VerificationResult;
  onReverify: () => void;
  reverifying: boolean;
}

type Status = 'pass' | 'partial' | 'unavailable';

function getChecks(r: VerificationResult): { label: string; status: Status }[] {
  return [
    {
      label: 'On-chain',
      status: r.existence.status === 'confirmed' ? 'pass' : r.existence.status === 'pending' ? 'partial' : 'unavailable',
    },
    {
      label: 'Authentic',
      status: r.authenticity.status === 'signature_verified' ? 'pass' : r.authenticity.status === 'hash_verified' ? 'partial' : 'unavailable',
    },
    {
      label: 'Signed',
      status: r.authenticity.signatureValid === true ? 'pass' : r.owner.address ? 'partial' : 'unavailable',
    },
  ];
}

const LEVEL_CONFIG: Record<number, {
  bg: string; border: string; iconColor: string;
  headColor: string; textColor: string; title: string;
  desc: string; Icon: typeof ShieldCheck;
}> = {
  3: {
    bg: 'bg-success/10',
    border: 'border-success/20',
    iconColor: 'text-success',
    headColor: 'text-success',
    textColor: 'text-success/80',
    title: 'Verified',
    desc: 'This data is authentic and untampered. Digital signature confirmed.',
    Icon: ShieldCheck,
  },
  2: {
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    iconColor: 'text-primary',
    headColor: 'text-primary',
    textColor: 'text-primary/70',
    title: 'Partially Verified',
    desc: 'Data fingerprint confirmed, but the digital signature could not be checked.',
    Icon: Check,
  },
  1: {
    bg: 'bg-card',
    border: 'border-border/20',
    iconColor: 'text-foreground/40',
    headColor: 'text-foreground/70',
    textColor: 'text-foreground/50',
    title: 'Pending',
    desc: 'Data found on the network. Full verification will be available once the gateway finishes indexing.',
    Icon: Clock,
  },
};

const PILL_STYLES: Record<Status, string> = {
  pass: 'bg-success/10 text-success',
  partial: 'bg-primary/10 text-primary',
  unavailable: 'bg-foreground/5 text-foreground/25',
};

export default function VerifyHero({ result, onReverify, reverifying }: Props) {
  const [copied, setCopied] = useState(false);
  const cfg = LEVEL_CONFIG[result.level] || LEVEL_CONFIG[1];
  const checks = getChecks(result);
  const { getCurrentConfig } = useStore();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Plain summary
  const parts: string[] = [];
  const type = contentLabel(result.metadata.contentType);
  const size = result.metadata.dataSize ? ` (${formatBytes(result.metadata.dataSize)})` : '';
  parts.push(`This ${type}${size}`);
  if (result.existence.blockTimestamp) {
    parts.push(`was stored on Arweave on ${formatDate(result.existence.blockTimestamp)}`);
  } else if (result.existence.status === 'confirmed') {
    parts.push('is confirmed on Arweave');
  } else {
    parts.push('was found on the Arweave network');
  }
  if (result.owner.address) {
    const addr = result.owner.address;
    const short = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    parts.push(result.authenticity.signatureValid ? `and signed by wallet ${short}` : `by wallet ${short}`);
  }
  if (result.authenticity.status === 'signature_verified') {
    parts.push('and has not been modified since');
  }
  const summary = parts.join(' ') + '.';

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <cfg.Icon className={`h-8 w-8 shrink-0 ${cfg.iconColor}`} />
          <div>
            <h2 className={`font-heading text-xl font-extrabold ${cfg.headColor}`}>{cfg.title}</h2>
            <p className={`mt-0.5 text-sm ${cfg.textColor}`}>{cfg.desc}</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <a
            href={getPdfUrl(getCurrentConfig().verifyApiUrl, result.verificationId)}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            download
          >
            Certificate
          </a>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
          >
            <Share2 className="h-3 w-3" />
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            onClick={onReverify}
            disabled={reverifying}
            className="rounded-full border border-border/20 bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5 disabled:opacity-50"
          >
            {reverifying ? 'Verifying...' : 'Re-verify'}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {checks.map((c) => (
          <span key={c.label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_STYLES[c.status]}`}>
            {c.status === 'pass' ? <Check className="h-3 w-3" /> : null}
            {c.label}
          </span>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-foreground/70">{summary}</p>

      {result.attestation && (
        <p className="mt-2 text-xs text-primary/70">
          <ShieldCheck className="mr-1 inline h-3 w-3" />
          Attested by gateway operator {result.attestation.operator.substring(0, 8)}...{result.attestation.operator.substring(result.attestation.operator.length - 4)} ({result.attestation.gateway})
        </p>
      )}

      <p className="mt-2 text-[11px] text-foreground/30">Verified {relativeTime(result.timestamp)}</p>
    </div>
  );
}
