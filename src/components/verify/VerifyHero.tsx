import { Check, Clock, Download, ShieldCheck, Share2 } from 'lucide-react';
import { useState } from 'react';
import { type VerificationResult, getPdfUrl } from '../../services/verificationService';
import { useStore } from '../../store/useStore';
import {
  relativeTime,
  formatBytes,
  contentLabel,
  rawDataUrl,
  downloadFilename,
} from './utils';

interface Props {
  result: VerificationResult;
  onReverify: () => void;
  reverifying: boolean;
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

export default function VerifyHero({ result, onReverify, reverifying }: Props) {
  const [copied, setCopied] = useState(false);
  const cfg = LEVEL_CONFIG[result.level] || LEVEL_CONFIG[1];
  const { getCurrentConfig } = useStore();
  const config = getCurrentConfig();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API unavailable (e.g. iframe/permissions policy)
    });
  };

  // Content type + size one-liner
  const type = contentLabel(result.metadata.contentType);
  const size = result.metadata.dataSize !== null ? formatBytes(result.metadata.dataSize) : null;
  const typeSummary = size ? `${type} \u00b7 ${size}` : type;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <cfg.Icon className={`h-6 w-6 shrink-0 ${cfg.iconColor}`} />
          <div>
            <h2 className={`font-heading text-xl font-bold ${cfg.headColor}`}>{cfg.title}</h2>
            <p className={`mt-0.5 text-sm ${cfg.textColor}`}>{cfg.desc}</p>
            <p className="mt-1.5 text-xs text-foreground/50">{typeSummary}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={rawDataUrl(config.verifyApiUrl, result.txId)}
            download={downloadFilename(result.txId, result.metadata.contentType)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
          <a
            href={getPdfUrl(config.verifyApiUrl, result.verificationId)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/20 bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
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
            className="inline-flex items-center rounded-full border border-border/20 bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5 disabled:opacity-50"
          >
            {reverifying ? 'Verifying...' : 'Re-verify'}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-foreground/30">Verified {relativeTime(result.timestamp)}</p>
    </div>
  );
}
