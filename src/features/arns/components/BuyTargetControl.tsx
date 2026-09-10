import { useEffect, useId, useMemo } from 'react';
import { ChevronDown, File, FileText, Globe } from 'lucide-react';

import {
  describeBuyTarget,
  describeOptionMeta,
  resolveBuyTarget,
  type BuyTargetMode,
  type BuyTargetState,
  type TargetOption,
  type TargetOptionKind,
} from '../purchase/buyTarget';

/** Matches the other ArNS editors — see RecordFieldsEditor / EditDetailsModal. */
const inputCls =
  'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary disabled:opacity-50';

const KIND_ICON: Record<TargetOptionKind, typeof Globe> = {
  site: Globe,
  page: FileText,
  file: File,
};

interface BuyTargetControlProps {
  value: BuyTargetState;
  onChange: (next: BuyTargetState) => void;
  /** The buyer's own recent work, from `buildTargetOptions`. */
  options: TargetOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  /** Injected so row dates stay pure/testable. Defaults to the wall clock. */
  now?: number;
}

/**
 * Where the name points on its first block, chosen at checkout.
 *
 * Collapsed by default, and the collapsed row states the ANSWER rather than the
 * setting — most buyers have nothing to point at yet and should be able to read
 * one line and move on rather than make a decision about transaction IDs in the
 * middle of paying.
 *
 * Open, it is a segmented control rather than one long list. The list-of-
 * everything version pushed payment and cost far below the fold for a field
 * most people skip; segments mean the default state shows no list at all, and
 * the three choices are genuinely different kinds of thing rather than peers.
 * The segment styling is the same one RecordFieldsEditor uses for its protocol
 * toggle, stretched full-width so three labels still fit at 320px.
 */
export function BuyTargetControl({
  value,
  onChange,
  options,
  open,
  onOpenChange,
  disabled = false,
  now,
}: BuyTargetControlProps) {
  const inputId = useId();
  const panelId = useId();

  const resolved = useMemo(() => resolveBuyTarget(value), [value]);
  // Read once per render rather than per row, so every date on screen is
  // measured against the same instant.
  const nowMs = now ?? Date.now();
  /*
    Dated, like the rows are. Two deploys of one site collapse to the same
    label, so an undated summary re-creates the exact ambiguity the rows were
    just fixed for — except here it is the only thing on screen.
  */
  const summary = useMemo(
    () => describeBuyTarget(value, options, nowMs),
    [value, options, nowMs],
  );

  /*
    An invalid id blocks the purchase, so it must never be hidden behind a
    collapsed row — that combination is a dead button with no visible cause.
    Same reflex as RecordFieldsEditor's Advanced section.
  */
  useEffect(() => {
    if (!resolved.valid && !open) onOpenChange(true);
  }, [resolved.valid, open, onOpenChange]);

  /*
    "Recent" is the word the rest of the app uses for exactly this list —
    UploadPanel, DeploySitePanel and CapturePanel all head their history with
    it. It is also the only accurate one: this list merges deploys, Pages and
    uploads, so "Recent Files" or "Recent Deployments" would each be wrong
    about two thirds of it.

    Offered only when there IS any. An empty segment leading to an empty list
    is a dead end, and it looks broken to exactly the people most likely to be
    new to this.
  */
  const segments: Array<{ mode: BuyTargetMode; label: string }> = [
    { mode: 'default', label: 'Default' },
    ...(options.length > 0
      ? [{ mode: 'deployment' as BuyTargetMode, label: 'Recent' }]
      : []),
    { mode: 'custom', label: 'Paste ID' },
  ];

  const selectMode = (mode: BuyTargetMode) => {
    if (mode === value.mode) return;
    // Carry the id across so switching segments to check something doesn't
    // discard what they already chose or typed.
    onChange({ mode, txId: mode === 'default' ? '' : value.txId });
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/20 bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            Points at
          </span>
          <span className="block truncate text-xs text-foreground/60">
            {summary}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
          {open ? 'Done' : 'Change'}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div id={panelId} className="mt-2">
          {/*
            `aria-pressed` buttons, not a tablist. Tab semantics promise a
            tabpanel per tab and the Default segment has no panel at all, so
            the roles would describe a structure that isn't there — worse for a
            screen reader than plain buttons. Matches the rest of this card.
          */}
          <div
            role="group"
            aria-label="Where the name points"
            className="flex w-full rounded-full border border-border/20 bg-card p-1"
          >
            {segments.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                aria-pressed={value.mode === mode}
                disabled={disabled}
                onClick={() => selectMode(mode)}
                className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 sm:text-sm ${
                  value.mode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/70 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {value.mode === 'deployment' && (
            /* Capped so a long history can't bury the payment step. The partial
               row at the cut is the scroll affordance. */
            <div className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {options.map((opt) => {
                const Icon = KIND_ICON[opt.kind];
                const selected = value.txId === opt.txId;
                return (
                  <button
                    key={opt.txId}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onChange({ mode: 'deployment', txId: opt.txId })}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:opacity-50 ${
                      selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/20 bg-background hover:border-primary/40'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-foreground/60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {opt.label}
                      </span>
                      <span className="block truncate text-xs text-foreground/60">
                        {describeOptionMeta(opt, nowMs)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {value.mode === 'custom' && (
            <div className="mt-2">
              <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
                Arweave TX ID
              </label>
              <input
                id={inputId}
                className={`${inputCls} font-mono`}
                value={value.txId}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
                /*
                  iOS capitalises the first character of a text input and runs
                  autocorrect over it. A tx id is case-sensitive base64url, so
                  either one silently turns a correct id into a rejected one —
                  and the user sees a validation error on something they typed
                  right. `spellCheck` alone does not cover this.
                */
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="43-character transaction ID"
              />
              {!resolved.valid && (
                <p className="mt-1 text-xs text-error">{resolved.error}</p>
              )}
            </div>
          )}

          <p className="mt-2 text-xs text-foreground/60">
            {/* Says what it costs, because "does this add a fee?" is the only
                question this control raises. */}
            {value.mode === 'default'
              ? 'Your name will resolve to an AR.IO placeholder page until you point it somewhere else.'
              : 'Set while the name is created, so it costs no extra transaction. You can change it any time from My Domains.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default BuyTargetControl;
