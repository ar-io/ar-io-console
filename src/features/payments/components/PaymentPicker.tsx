import { useId, type ReactNode } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Radio,
  RadioGroup,
} from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';

import {
  formatSourceAmount,
  isSelectable,
  type PaymentMethod,
  type PaymentSource,
  type SourceGroup,
} from '../paymentSources';
import { TokenCoin } from './TokenCoin';
// Holdings abbreviate (1.5M ARIO) exactly as the name checkout always has.
import { formatHeldBalance } from '../../arns/purchase/formatBalance';

/** One segment of a segmented control, already worded by the host. */
export interface Segment<T extends string> {
  value: T;
  label: string;
  /** Shown instead of `label` on phones, where a long label would be cut. */
  shortLabel?: string;
  /** Second line, small and muted: a price ("0.23 credits", "$1.49"). */
  sub?: string;
  /**
   * The segment cannot complete as things stand (credits short of the price),
   * but stays selectable, as it always has been. Dimmed, with the reason on
   * hover and to a screen reader; the status line says it in full once chosen.
   */
  hint?: string;
  disabled?: boolean;
}

/**
 * A segmented control: one rounded container, equal-width segments, the chosen
 * one in the checkout's own selected style (primary border, lavender tint,
 * foreground text), the same as the Lease / Permabuy toggle that sits directly
 * above it. A solid fill here would put two selection languages on one card.
 * Built on a Headless UI radio group so arrow keys move the choice and the
 * global focus outline applies.
 *
 * If any segment has a second line, every segment reserves one, so the row
 * keeps one height whichever segments have a price.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  segments: Segment<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  // Segments stretch to one height, so a segment without a second line sits
  // centred beside those with one rather than carrying an empty line.
  const twoLine = segments.some((s) => s.sub !== undefined);
  return (
    <RadioGroup
      value={value ?? null}
      onChange={(v: T | null) => v && onChange(v)}
      disabled={disabled}
      aria-labelledby={labelledBy}
      className="flex w-full gap-1 rounded-2xl border border-border/20 bg-card p-1"
    >
      {segments.map((segment) => (
        <Radio
          key={segment.value}
          value={segment.value}
          disabled={segment.disabled}
          title={segment.hint}
          className={`group flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-[16px] border border-transparent px-2 text-center transition-colors data-[checked]:border-primary data-[checked]:bg-primary/10 data-[checked]:text-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${
            twoLine ? 'py-1' : 'py-2'
          } ${
            segment.hint
              ? 'text-foreground/50 hover:text-foreground/70'
              : 'text-foreground/70 hover:text-foreground'
          }`}
        >
          <span className="block max-w-full truncate text-sm font-medium leading-[1.125rem]">
            {segment.shortLabel ? (
              <>
                <span className="sm:hidden">{segment.shortLabel}</span>
                <span className="hidden sm:inline">{segment.label}</span>
              </>
            ) : (
              segment.label
            )}
          </span>
          {segment.sub !== undefined && (
            <span className="block max-w-full truncate text-xs leading-4 text-foreground/60 tabular-nums group-data-[checked]:text-foreground/70">
              {segment.sub}
            </span>
          )}
          {segment.hint && <span className="sr-only">, {segment.hint}</span>}
        </Radio>
      ))}
    </RadioGroup>
  );
}

/** One of the three top-level choices, already worded by the host. */
export interface MethodChoice extends Segment<PaymentMethod> {
  /** The status line while this method is chosen. Crypto derives its own. */
  status?: string;
  statusTone?: 'muted' | 'error';
}

export interface CryptoSourcesProps {
  groups: SourceGroup[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Appended to the status line, e.g. "paid from your Solana wallet". */
  note?: string;
  /** An approximate dollar figure for a row's price, where one is known. */
  usdFor?: (source: PaymentSource) => string | undefined;
  /** What a row costs beyond its own price, e.g. "+ 0.056 SOL" for ARIO. */
  extraFor?: (source: PaymentSource) => string | undefined;
  disabled?: boolean;
  /** Spoken before the current choice, since no visible label names the select. */
  label?: string;
}

/**
 * "Pay with" (SPEC-payment-sources § 7.1): one segmented control, one status
 * line, and, while Crypto is chosen, one token select.
 *
 * Deliberately flat and short. The first version gave each method a card and
 * nested the token dropdown inside the Crypto card, which cost a card of height
 * per method (in a renew modal that already scrolls) and read as a frame inside
 * a frame. This one is label, control, select, and a single line of status.
 *
 * `note` is the host's wallet disclosure. It joins the status line rather than
 * sitting on a line of its own: one line under the control, not two.
 */
export function PaymentPicker({
  choices,
  value,
  onChange,
  crypto,
  disabled,
  heading = 'Pay with',
  note,
  cryptoPreview = false,
}: {
  choices: MethodChoice[];
  value: PaymentMethod | undefined;
  onChange: (method: PaymentMethod) => void;
  crypto?: CryptoSourcesProps;
  disabled?: boolean;
  heading?: string;
  /** The host's wallet note, folded into the status line. */
  note?: string;
  /**
   * Show the token select without Crypto being the routed choice: used when
   * no token can pay, so the reasons can be read. The segments are untouched.
   */
  cryptoPreview?: boolean;
}) {
  const headingId = useId();
  const chosen = choices.find((c) => c.value === value);
  const showCrypto =
    (value === 'crypto' || cryptoPreview) && !!crypto && crypto.groups.length > 0;

  return (
    <div>
      <p id={headingId} className="mb-1 block text-sm font-medium">
        {heading}
      </p>
      <SegmentedControl
        segments={choices}
        value={value}
        onChange={onChange}
        labelledBy={headingId}
        disabled={disabled}
      />
      {showCrypto ? (
        <div className="mt-2">
          <CryptoSourceListbox
            {...crypto}
            note={[crypto.note, note].filter(Boolean).join(' · ') || undefined}
            disabled={disabled || crypto.disabled}
            label={crypto.label ?? 'Token to pay with'}
          />
        </div>
      ) : (
        (() => {
          /*
            One line: the method's own status, then the wallet note. Card is
            the exception: "via Stripe" says less than the wallet note, so the
            note replaces it rather than making the line wrap on a phone.
          */
          const own = chosen?.value === 'card' && note ? undefined : chosen?.status;
          if (!own && !note) return null;
          return (
            <StatusLine tone={chosen?.statusTone}>
              {own}
              {own && note ? (
                <span className="text-foreground/60"> · {note}</span>
              ) : (
                !own && note
              )}
            </StatusLine>
          );
        })()
      )}
    </div>
  );
}

function StatusLine({ tone, children }: { tone?: 'muted' | 'error'; children: ReactNode }) {
  return (
    <p
      className={`mt-1.5 text-xs leading-4 ${tone === 'error' ? 'text-error/80' : 'text-foreground/60'}`}
      aria-live="polite"
    >
      {children}
    </p>
  );
}

/**
 * What a row says after its name: why it cannot be used, or what it holds.
 * Nothing at all when the balance is unknown (signed out, or a token this
 * surface does not read) rather than a placeholder on every row.
 */
function rowDetail(source: PaymentSource): { text: string; error?: boolean } | undefined {
  if (source.disabledReason) return { text: source.disabledReason, error: true };
  const parts = [
    source.balanceLoading
      ? 'Bal …'
      : source.balance !== undefined
        ? `Bal ${formatHeldBalance(source.balance)}`
        : undefined,
    source.wait,
  ].filter(Boolean);
  return parts.length > 0 ? { text: parts.join(' · ') } : undefined;
}

/**
 * One token, identical in the button and in every option.
 *
 * Desktop, one line: coin, token, network, detail, badge, and the price
 * right-aligned. Phone, two: the name line, then price and detail, starting
 * where the name starts. `mobileTwoLines` forces the second line (blank if
 * need be) so every row in one list is the same height.
 */
function SourceLine({
  source,
  usd,
  extra,
  detail,
  mobileTwoLines,
}: {
  source: PaymentSource;
  usd?: string;
  /** Appended to the price, e.g. "+ 0.056 SOL". */
  extra?: string;
  detail?: { text: string; error?: boolean };
  mobileTwoLines?: boolean;
}) {
  const price =
    source.price !== undefined ? (
      <span className="whitespace-nowrap text-sm font-medium text-foreground tabular-nums">
        {formatSourceAmount(source.price)} {source.label}
        {extra && <span className="font-normal text-foreground/80"> {extra}</span>}
        {usd && <span className="ml-1 text-xs font-normal text-foreground/60">{usd}</span>}
      </span>
    ) : null;
  const detailEl = (className: string) =>
    detail ? (
      <span
        className={`truncate text-xs ${detail.error ? 'text-error/80' : 'text-foreground/60'} ${className}`}
      >
        {detail.text}
      </span>
    ) : null;
  const secondLine = !!price || !!detail || !!mobileTwoLines;

  return (
    <span className="flex min-w-0 flex-1 items-start gap-2.5 leading-5">
      <span className="flex h-5 flex-none items-center">
        <TokenCoin token={source.token} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{source.label}</span>
          {source.network && (
            <span className="flex-none text-xs text-foreground/60">{source.network}</span>
          )}
          {detailEl('hidden sm:inline')}
          {source.badge && (
            <span className="flex-none rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary">
              {source.badge}
            </span>
          )}
        </span>
        {/* Desktop: the price on the right. */}
        {price && <span className="hidden flex-none sm:inline">{price}</span>}
        {/* Phone: price and detail on a second line, under the name. */}
        {secondLine && (
          <span className="flex min-w-0 items-baseline gap-1.5 sm:hidden">
            {price}
            {price && detail && <span className="text-xs text-foreground/40">·</span>}
            {detailEl('')}
            {!price && !detail && '\u00A0'}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * The token select (§ 7.2), flat on the page.
 *
 * The open list opens under the button, in the page's own DOM (see the note on
 * `ListboxOptions`). Rows are one line on desktop (two on a phone, all alike),
 * so eight tokens fit before it scrolls.
 *
 * A row that cannot be paid with stays in the list with its reason and stays
 * reachable by keyboard: it is not marked `disabled` to Headless UI (which
 * would skip it), and choosing it is simply ignored.
 */
export function CryptoSourceListbox({
  groups,
  selectedId,
  onSelect,
  note,
  usdFor,
  extraFor,
  disabled,
  label,
}: CryptoSourcesProps) {
  const all = groups.flatMap((g) => g.sources);
  const selected = all.find((s) => s.id === selectedId) ?? all[0];
  if (!selected) return null;

  const held =
    selected.balance !== undefined
      ? `Balance ${formatHeldBalance(selected.balance)} ${selected.label}`
      : undefined;
  const statusParts = [held, selected.wait, note].filter(Boolean);
  const status = selected.disabledReason ? (
    <StatusLine tone="error">{selected.disabledReason}</StatusLine>
  ) : statusParts.length > 0 ? (
    <StatusLine>{statusParts.join(' · ')}</StatusLine>
  ) : null;

  // Equal heights on a phone: if any row needs a second line, every row gets one.
  const mobileTwoLines = all.some((s) => s.price !== undefined || !!rowDetail(s));

  const box =
    'flex w-full items-start gap-2 rounded-2xl border border-border/20 bg-background px-3 py-2 text-left';

  if (all.length === 1) {
    // One token is a fact, not a choice: shown the same way, without a menu.
    return (
      <div>
        <div className={box}>
          <SourceLine source={selected} usd={usdFor?.(selected)} extra={extraFor?.(selected)} />
        </div>
        {status}
      </div>
    );
  }

  return (
    <div>
      <Listbox
        value={selected.id}
        onChange={(id: string) => {
          const s = all.find((x) => x.id === id);
          if (s && isSelectable(s)) onSelect(id);
        }}
        disabled={disabled}
        as="div"
        className="relative"
      >
        <ListboxButton
          className={`${box} cursor-pointer transition-colors hover:border-primary/40 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50`}
        >
          {/* Named, but not by aria-label, which would hide the current
              choice from a screen reader behind the control's name. */}
          {label && <span className="sr-only">{label}: </span>}
          <SourceLine source={selected} usd={usdFor?.(selected)} extra={extraFor?.(selected)} />
          <span className="flex h-5 flex-none items-center">
            <ChevronDown className="h-4 w-4 text-foreground/60" aria-hidden="true" />
          </span>
        </ListboxButton>
        {/*
          Not anchored and not portalled: it is placed under the button, inside
          the same DOM as everything else. Portalled, it sat outside
          BaseModal's panel, so Tab tripped the modal's focus trap (jumping a
          scrolled modal to the top) and a screen reader could treat the
          options as outside the aria-modal dialog. Anchored, it flipped up
          over "Pay with" on a phone. Here it always opens downward; on the
          page it overlays what is below, and inside a modal's scroll
          container it extends the scroll area rather than being clipped.
        */}
        <ListboxOptions className="absolute inset-x-0 top-full z-30 mt-1 max-h-[28rem] overflow-auto rounded-2xl border border-border/20 bg-background py-1 shadow-lg focus:outline-none">
          {groups.map((group) => (
            <div key={group.wallet} role="group" aria-label={group.heading}>
              <div
                aria-hidden="true"
                className="px-3 pb-0.5 pt-2 text-[11px] font-medium uppercase leading-4 tracking-wide text-foreground/50"
              >
                {group.heading}
              </div>
              {group.sources.map((source) => {
                const blocked = !isSelectable(source);
                return (
                  <ListboxOption
                    key={source.id}
                    value={source.id}
                    /*
                      Announced as unavailable while staying reachable.
                      Headless UI's own `disabled` would skip the row, and an
                      `aria-disabled` prop is overwritten: the option merges its
                      own `aria-disabled: undefined` last. So it is set on the
                      element directly; React never manages that attribute
                      here, so nothing resets it.
                    */
                    ref={(el: HTMLElement | null) => {
                      if (!el) return;
                      if (blocked) el.setAttribute('aria-disabled', 'true');
                      else el.removeAttribute('aria-disabled');
                    }}
                    className={`group flex items-start gap-2 px-3 py-2.5 sm:py-3 data-[focus]:bg-primary/10 ${
                      blocked ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <SourceLine
                      source={source}
                      usd={usdFor?.(source)}
                      extra={extraFor?.(source)}
                      detail={rowDetail(source)}
                      mobileTwoLines={mobileTwoLines}
                    />
                    <span className="flex h-5 w-4 flex-none items-center">
                      <Check
                        className="invisible h-4 w-4 text-primary group-data-[selected]:visible"
                        aria-hidden="true"
                      />
                    </span>
                  </ListboxOption>
                );
              })}
            </div>
          ))}
        </ListboxOptions>
      </Listbox>
      {status}
    </div>
  );
}
