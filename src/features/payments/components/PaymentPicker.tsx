import { useId, type ReactNode } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Radio,
  RadioGroup,
} from '@headlessui/react';
import { Check, CheckCircle2, ChevronDown, Circle } from 'lucide-react';

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

/** One of the three top-level choices, already worded by the host. */
export interface MethodChoice {
  method: PaymentMethod;
  label: string;
  icon: ReactNode;
  /** Muted second word: "2.45 credits", "via Stripe". */
  detail?: string;
  /** What it costs, in its own unit: "$49.51", "6.61 credits". */
  price?: string;
  /** Shown in place of the price when this choice falls short. */
  reason?: string;
  disabled?: boolean;
}

export interface CryptoSourcesProps {
  groups: SourceGroup[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** One line under the dropdown, e.g. "Paid from your Solana wallet". */
  note?: ReactNode;
  /** An approximate dollar figure for a row's price, where one is known. */
  usdFor?: (source: PaymentSource) => string | undefined;
  disabled?: boolean;
  /** Spoken before the current choice, since no visible label names the dropdown. */
  label?: string;
}

/**
 * "Pay with": Credits, Card, Crypto, one line each (SPEC-payment-sources § 7.1).
 *
 * A radio group rather than a row of cards. A flat row of equal cards stopped
 * scanning once an Ethereum session had seven of them, and every new token made
 * it worse. Three choices stay three choices; the tokens live in one dropdown
 * under Crypto, grouped by the wallet that pays.
 *
 * The dropdown is shown whatever is selected, so its collapsed row (and ARIO's
 * "Best price" with it) is visible to someone still sitting on Card. Choosing a
 * token from it chooses Crypto too: one decision, not two.
 */
export function PaymentPicker({
  choices,
  value,
  onChange,
  crypto,
  disabled,
  heading = 'Pay with',
  note,
}: {
  choices: MethodChoice[];
  value: PaymentMethod | undefined;
  onChange: (method: PaymentMethod) => void;
  crypto?: CryptoSourcesProps;
  disabled?: boolean;
  heading?: string;
  /** A line explaining the choice, under the heading. */
  note?: ReactNode;
}) {
  const headingId = useId();
  return (
    <div>
      <p id={headingId} className="mb-1 block text-sm font-medium">
        {heading}
      </p>
      {note && <p className="mb-2 text-xs text-foreground/70">{note}</p>}
      <RadioGroup
        value={value ?? null}
        onChange={(m: PaymentMethod | null) => m && onChange(m)}
        disabled={disabled}
        aria-labelledby={headingId}
        className="flex flex-col gap-2"
      >
        {choices.map((choice) => {
          const checked = choice.method === value;
          const showCrypto =
            choice.method === 'crypto' && !!crypto && crypto.groups.length > 0;
          return (
            <div
              key={choice.method}
              className={`rounded-2xl border transition-colors ${
                checked
                  ? 'border-primary bg-primary/10'
                  : // Lights up for the radio only, not for the dropdown that
                    // shares this card: hovering the token list is not a vote
                    // for "Crypto" until something in it is chosen.
                    'border-border/20 bg-card has-[[role=radio]:hover]:border-primary/40'
              }`}
            >
              <Radio
                value={choice.method}
                disabled={choice.disabled}
                className="flex w-full cursor-pointer items-start gap-3 rounded-2xl p-3 text-left data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
              >
                {checked ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 flex-none text-foreground/40" aria-hidden="true" />
                )}
                <span
                  className={`mt-0.5 flex h-4 w-5 flex-none items-center justify-center ${
                    checked ? 'text-primary' : 'text-foreground/60'
                  }`}
                  aria-hidden="true"
                >
                  {choice.icon}
                </span>
                {/*
                  Wraps rather than truncates: on a phone the price drops under
                  the label instead of being cut, and a number cut mid-digits
                  reads as broken.
                */}
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{choice.label}</span>
                    {choice.detail && (
                      <span className="ml-2 text-xs text-foreground/60">{choice.detail}</span>
                    )}
                  </span>
                  {choice.reason ? (
                    <span className="text-xs text-error/80">{choice.reason}</span>
                  ) : choice.price ? (
                    <span className="text-sm font-medium text-foreground">{choice.price}</span>
                  ) : null}
                </span>
              </Radio>
              {showCrypto && (
                /*
                  Outside the Radio, so the dropdown is its own control rather
                  than a button nested in a radio. The keydown stop keeps the
                  radio group's arrow-key and Enter handling from also acting
                  on keys meant for the dropdown.
                */
                <div
                  className="px-3 pb-3 sm:pl-[4.5rem]"
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <CryptoSourceListbox
                    {...crypto}
                    disabled={disabled || crypto.disabled}
                    label={crypto.label ?? 'Token to pay with'}
                  />
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}

function SourceSummary({
  source,
  usd,
  compact,
}: {
  source: PaymentSource;
  usd?: string;
  /** The collapsed button: price only, no reason (the reason is in the list). */
  compact?: boolean;
}) {
  const unit = source.label;
  const held =
    source.balanceLoading
      ? '…'
      : source.balance !== undefined
        ? `${formatHeldBalance(source.balance)} ${unit}`
        : undefined;
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <TokenCoin token={source.token} />
          <span className="font-medium text-foreground">{source.label}</span>
          {source.network && (
            <span className="text-xs text-foreground/60">{source.network}</span>
          )}
          {source.badge && (
            <span className="flex-none rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary">
              {source.badge}
            </span>
          )}
        </span>
        {source.price !== undefined && (
          <span className="text-sm font-medium text-foreground">
            {formatSourceAmount(source.price)} {unit}
            {usd && <span className="ml-1 text-xs font-normal text-foreground/60">{usd}</span>}
          </span>
        )}
      </span>
      {(held || source.wait) && (
        <span className="pl-7 text-xs text-foreground/60">
          {held && <>Balance {held}</>}
          {held && source.wait && ' · '}
          {source.wait}
        </span>
      )}
      {!compact && source.disabledReason && (
        <span className="pl-7 text-xs text-error/80">{source.disabledReason}</span>
      )}
    </span>
  );
}

/**
 * The crypto dropdown (§ 7.2): rows grouped by wallet, each with token,
 * balance and price. A row that cannot be paid with stays in the list, with
 * its reason, and stays reachable by keyboard: it is not marked `disabled` to
 * Headless UI (which would skip it), and choosing it is simply ignored. Hiding
 * it, or skipping it silently, would leave the user wondering where it went.
 */
export function CryptoSourceListbox({
  groups,
  selectedId,
  onSelect,
  note,
  usdFor,
  disabled,
  label,
}: CryptoSourcesProps) {
  const all = groups.flatMap((g) => g.sources);
  const selected = all.find((s) => s.id === selectedId) ?? all[0];
  if (!selected) return null;

  const onlyOne = all.length === 1;

  return (
    <div>
      {onlyOne ? (
        // One row is a fact, not a choice: shown, but not as a dropdown.
        <div className="flex w-full items-start gap-2 rounded-xl border border-border/20 bg-background px-3 py-2.5">
          <SourceSummary source={selected} usd={usdFor?.(selected)} />
        </div>
      ) : (
        <Listbox
          value={selected.id}
          onChange={(id: string) => {
            const s = all.find((x) => x.id === id);
            if (s && isSelectable(s)) onSelect(id);
          }}
          disabled={disabled}
        >
          <div className="relative">
            <ListboxButton className="flex w-full cursor-pointer items-start gap-2 rounded-xl border border-border/20 bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
              {/* Named, but not by aria-label, which would hide the current
                  choice from a screen reader behind the control's name. */}
              {label && <span className="sr-only">{label}: </span>}
              <SourceSummary source={selected} usd={usdFor?.(selected)} compact />
              <ChevronDown className="mt-0.5 h-4 w-4 flex-none text-foreground/60" aria-hidden="true" />
            </ListboxButton>
            <ListboxOptions className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-2xl border border-border/20 bg-background py-1 shadow-lg focus:outline-none">
              {groups.map((group) => (
                <div key={group.wallet} role="group" aria-label={group.heading}>
                  <div aria-hidden="true" className="px-3 pb-1 pt-2 text-xs font-medium text-foreground/60">
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
                          Headless UI's own `disabled` would skip the row, and
                          an `aria-disabled` prop is overwritten: the option
                          merges its own `aria-disabled: undefined` last. So it
                          is set on the element directly; React never manages
                          that attribute here, so nothing resets it.
                        */
                        ref={(el: HTMLElement | null) => {
                          if (!el) return;
                          if (blocked) el.setAttribute('aria-disabled', 'true');
                          else el.removeAttribute('aria-disabled');
                        }}
                        className={`flex items-start gap-2 px-3 py-2 data-[focus]:bg-primary/10 ${
                          blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                      >
                        {({ selected: isSelected }) => (
                          <>
                            <SourceSummary source={source} usd={usdFor?.(source)} />
                            <Check
                              className={`mt-0.5 h-4 w-4 flex-none text-primary ${
                                isSelected ? '' : 'invisible'
                              }`}
                              aria-hidden="true"
                            />
                          </>
                        )}
                      </ListboxOption>
                    );
                  })}
                </div>
              ))}
            </ListboxOptions>
          </div>
        </Listbox>
      )}
      {selected.disabledReason && (
        <p className="mt-1 text-xs text-error/80">{selected.disabledReason}</p>
      )}
      {note && <p className="mt-1 text-xs text-foreground/70">{note}</p>}
    </div>
  );
}
