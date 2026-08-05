import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2 } from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import CopyButton from '../../../components/CopyButton';
import { daysRemaining } from '../../../utils';
import { isArweaveTxId, isValidIpfsCid } from '../utils';
import type { AllArNSRecord } from '../hooks/useAllArNSNames';

/** Classify a resolved target id so we can label it Arweave vs IPFS. */
function targetKind(id: string): 'Arweave' | 'IPFS' | null {
  if (isArweaveTxId(id)) return 'Arweave';
  if (isValidIpfsCid(id)) return 'IPFS';
  return null;
}

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—';

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border/10 last:border-0">
      <span className="text-sm text-foreground/60 flex-shrink-0">{label}</span>
      <div className="text-sm text-foreground text-right min-w-0">{children}</div>
    </div>
  );
}

/**
 * Read-only detail view for a single ArNS name from the Browse table. Surfaces
 * everything the row can't: full ANT process id, the current resolved target
 * (Arweave/IPFS), and the exact registration + expiry dates. The target is
 * resolved once, on open (one ANT RPC), instead of on every row of the table.
 */
export default function DomainDetailsModal({
  record,
  target,
  resolveTarget,
  onClose,
}: {
  record: AllArNSRecord;
  /** Cached target for this processId: string = id, null = none set, undefined = not yet resolved. */
  target: string | null | undefined;
  resolveTarget: (processId: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [resolving, setResolving] = useState(target === undefined);

  useEffect(() => {
    if (target !== undefined) return;
    let cancelled = false;
    setResolving(true);
    resolveTarget(record.processId).finally(() => {
      if (!cancelled) setResolving(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.processId]);

  const kind = target ? targetKind(target) : null;

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="max-h-[88vh] w-[92vw] max-w-md overflow-y-auto p-6">
        {/* Title */}
        <div className="mb-5 flex items-center gap-2 min-w-0">
          <Globe className="w-5 h-5 text-primary flex-shrink-0" />
          <h3 className="font-heading text-xl font-bold text-foreground truncate">
            {record.name}
            <span className="text-foreground/50 font-normal">.ar.io</span>
          </h3>
        </div>

        <div className="rounded-2xl border border-border/20 bg-card px-4">
          <Row label="Type">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                record.type === 'permabuy'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-foreground/10 text-foreground/80'
              }`}
            >
              {record.type === 'permabuy' ? 'Permanent' : 'Lease'}
            </span>
          </Row>

          <Row label="Registered">{fmtDate(record.startTimestamp)}</Row>

          <Row label="Expires">
            {record.type === 'permabuy' ? (
              'Never'
            ) : record.endTimestamp ? (
              <div>
                {fmtDate(record.endTimestamp)}
                <div className="text-xs text-foreground/50">
                  in {daysRemaining(new Date(record.endTimestamp))} days
                </div>
              </div>
            ) : (
              '—'
            )}
          </Row>

          {record.undernameLimit != null && (
            <Row label="Undernames">{record.undernameLimit.toLocaleString()}</Row>
          )}

          <Row label="Current target">
            {resolving ? (
              <span className="inline-flex items-center gap-1.5 text-foreground/60">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving…
              </span>
            ) : target ? (
              <div className="flex items-center justify-end gap-1 min-w-0">
                {kind && (
                  <span className="text-xs text-foreground/50 flex-shrink-0">
                    {kind}
                  </span>
                )}
                <span className="font-mono text-xs truncate">{target}</span>
                <CopyButton textToCopy={target} />
              </div>
            ) : (
              <span className="text-foreground/50">No target set</span>
            )}
          </Row>

          <Row label="Name token (ANT)">
            <div className="flex items-center justify-end gap-1 min-w-0">
              <span className="font-mono text-xs truncate">{record.processId}</span>
              <CopyButton textToCopy={record.processId} />
            </div>
          </Row>
        </div>

        {/* Visit */}
        <a
          href={`https://${record.name}.ar.io`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        >
          Visit {record.name}.ar.io
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </BaseModal>
  );
}
