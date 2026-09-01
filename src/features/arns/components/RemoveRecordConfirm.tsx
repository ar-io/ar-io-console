import { Loader2, Trash2 } from 'lucide-react';

import BaseModal from '../../../components/modals/BaseModal';
import ModalHeader from '../../../components/modals/ModalHeader';
import { useArNSActionPrice } from '../hooks/useArNSActionPrice';

/**
 * Confirm removing one record, and name what it costs.
 *
 * Removing is a CHARGED action (0.05 credits on production, 0 on testnet), and
 * it is triggered from a collapsed row — so the cost line in the record editor
 * never applies to it. Without this the user presses a small icon in a row of
 * icons and is billed with no warning, which is the exact failure the pricing
 * work exists to prevent.
 *
 * It earns the interruption twice over: the trash sits beside the edit pencil
 * at icon size, so a mis-click is easy, and a removed record stops resolving
 * immediately for anyone using it.
 *
 * Chrome comes from `BaseModal` — Escape, focus trap and scroll lock included
 * — rather than a hand-rolled panel.
 */
export default function RemoveRecordConfirm({
  undername,
  displayName,
  busy,
  onConfirm,
  onCancel,
}: {
  /** The record's label, e.g. `docs`. */
  undername: string;
  /**
   * The name it belongs to, for the sentence that says what breaks. Optional
   * because the table's own `name` prop is — the sentence degrades rather than
   * the dialog failing to render over a missing label.
   */
  displayName?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { credits } = useArNSActionPrice('remove-record');

  const cost =
    credits === undefined
      ? 'a small amount of credits'
      : credits === 0
        ? 'nothing on this network'
        : `about ${credits.toLocaleString(undefined, {
            maximumFractionDigits: 4,
          })} credits`;

  return (
    /*
      Not dismissible mid-removal. Escape, a backdrop click or the close button
      would otherwise cancel the DIALOG while the write is still in flight —
      the user sees it vanish, assumes nothing happened, and the record
      disappears a moment later with no explanation.
    */
    <BaseModal onClose={onCancel} showCloseButton dismissible={!busy}>
      <div className="w-[92vw] max-w-md p-4 sm:p-5">
        <ModalHeader
          icon={Trash2}
          title={
            <>
              Remove{' '}
              <span className="break-all font-mono text-primary">
                {undername}
              </span>
              ?
            </>
          }
          description="This record will stop resolving"
        />

        <p className="mb-4 text-sm text-foreground/80">
          {displayName
            ? `${undername}.${displayName}.ar.io will stop working for anyone using it.`
            : 'This record will stop working for anyone using it.'}{' '}
          You can add it back later. Removing costs {cost}.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-border/20 bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Removing…
              </>
            ) : (
              'Remove record'
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
