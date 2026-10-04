import { getExplorerTxUrl } from '@/utils/getExplorerTxUrl';

/**
 * The receipt line on an ArNS success state.
 *
 * Every ArNS write lands on Solana and returns a transaction id, and each
 * success screen had been doing something different with it: two linked it,
 * one printed it raw as `tx: <43 chars>`, and the rest dropped it. A raw id is
 * unactionable — it looks technical and there is nothing a user can do with it
 * — while a link is the difference between "take our word for it" and
 * something anyone can verify.
 *
 * Falls back to the bare id rather than rendering nothing if we have no
 * explorer for the network: losing the only proof the write happened is worse
 * than showing it unlinked.
 */
export default function TransactionReceipt({
  txId,
  className = '',
}: {
  txId: string | undefined;
  className?: string;
}) {
  if (!txId) return null;

  // ArNS writes settle on Solana, whatever the user paid with.
  const url = getExplorerTxUrl(txId, 'solana');

  /*
    The link sits in its own block. As a bare inline element it shared a line
    with whatever followed it, and on the success screens that is a Close
    button: the two ran into each other.
  */
  return url ? (
    <p className={className}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-primary hover:underline"
      >
        View transaction
      </a>
    </p>
  ) : (
    <div
      className={`break-all font-mono text-xs text-foreground/50 ${className}`}
    >
      {txId}
    </div>
  );
}
