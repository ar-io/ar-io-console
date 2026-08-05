import { useCallback, useState } from 'react';

import { APP_NAME } from '../../../constants';
import { getWritableARIO, removePrimaryName, WRITE_OPTIONS } from '../../../utils';
import { lowerCaseDomain } from '../utils';
import { useArNSTurboSigner } from './useArNSTurboSigner';
import type { ArNSBuyFundFrom } from './useBuyArNSName';

export type PrimaryNamePhase = 'idle' | 'submitting' | 'success' | 'error';

/** Options for setting/changing the connected wallet's primary name. */
export interface SetPrimaryNameInput {
  /** ArNS name (apex `myname` or undername `blog_myname`). */
  name: string;
  /** Funding source for the ARIO price. Defaults to Turbo Credits. */
  fundFrom?: ArNSBuyFundFrom;
}

/** Options for the base-name owner approving a pending primary request. */
export interface ApprovePrimaryNameInput {
  /** The requested primary name. */
  name: string;
  /** The request initiator's wallet address. */
  address: string;
}

export interface UsePrimaryNameActionsResult {
  /** Set/change the connected wallet's primary name (request + self-approve). */
  setPrimaryName: (input: SetPrimaryNameInput) => Promise<string | undefined>;
  /** Request a primary name you do NOT own (leaves a pending request). */
  requestPrimaryName: (input: SetPrimaryNameInput) => Promise<string | undefined>;
  /** Base-name owner approves a pending primary-name request. */
  approveRequest: (input: ApprovePrimaryNameInput) => Promise<string | undefined>;
  /** Remove the connected wallet's current primary name (clears reverse link). */
  removePrimary: (name: string) => Promise<string | undefined>;
  reset: () => void;
  phase: PrimaryNamePhase;
  statusMessage: string;
  error: Error | undefined;
  /** True when the failure was insufficient credits — the UI offers Top-Up. */
  insufficientCredits: boolean;
  isBusy: boolean;
}

/** Structural view of the ARIO writeable's primary-name setters. */
type ARIOPrimaryWriteable = {
  setPrimaryName(
    p: { name: string; fundFrom?: ArNSBuyFundFrom; referrer?: string },
    options?: {
      tags?: { name: string; value: string }[];
      onSigningProgress?: (name: string, payload: unknown) => void;
    },
  ): Promise<{ id: string }>;
  requestPrimaryName(
    p: { name: string; fundFrom?: ArNSBuyFundFrom; referrer?: string },
    options?: {
      tags?: { name: string; value: string }[];
    },
  ): Promise<{ id: string }>;
  /**
   * Base-name owner approves a pending primary-name request. On Solana this is
   * an ario-core write (the ANT writeable's `approvePrimaryNameRequest` throws
   * "not applicable on Solana"), so it takes no `arioProcessId`.
   */
  approvePrimaryName(
    p: { initiator: string; name: string },
    options?: {
      tags?: { name: string; value: string }[];
    },
  ): Promise<{ id: string }>;
};

function isInsufficientCredits(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // `\b402\b` (not a bare `402`) so unrelated digit runs — tx-signature
  // fragments, program error codes, slot numbers — aren't misread as an
  // insufficient-funds / HTTP-402 signal and swallowed as a top-up prompt.
  return /insufficient|not enough|balance too low|underfunded|exceeds balance|\b402\b/i.test(
    msg,
  );
}

/** Map a `SetPrimaryNameProgressEvents` step to a user-facing status message. */
function progressMessage(step: string, name: string): string {
  switch (step) {
    case 'requesting-primary-name':
      return `Requesting '${name}' as your primary name…`;
    case 'request-already-exists':
      return `A request for '${name}' already exists — approving…`;
    case 'approving-request':
      return `Approving '${name}'…`;
    default:
      return `Setting '${name}' as your primary name…`;
  }
}

/**
 * Solana-only writes for ArNS **primary name** (reverse-resolution) management.
 *
 * The canonical set/change path is `ARIO.setPrimaryName` — a single ARIO write
 * that does request AND self-approve when the connected wallet owns the name
 * (the console's common case), emitting `SetPrimaryNameProgressEvents` we surface
 * as the one-approval-per-step progress message. `requestPrimaryName` covers the
 * case where the wallet does NOT own the name (leaves a pending request for the
 * base-name owner). `approveRequest` is the base-name owner path — a single
 * ario-core write (`ARIO.approvePrimaryName`); on Solana the ANT-level
 * `approvePrimaryNameRequest`/`removePrimaryNames` handlers are not applicable,
 * so this hook never routes primary-name writes through the ANT.
 *
 * Mirrors the ergonomics of {@link useManageArNSName}/`useUndernameWrites`:
 * each action is one wallet signature, normalizes errors, flags insufficient
 * credits for a Top-Up hand-off, and dispatches `refresh-balance` on success.
 */
export function usePrimaryNameActions(): UsePrimaryNameActionsResult {
  const signer = useArNSTurboSigner();

  const [phase, setPhase] = useState<PrimaryNamePhase>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<Error | undefined>();
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  const reset = useCallback(() => {
    setPhase('idle');
    setStatusMessage('');
    setError(undefined);
    setInsufficientCredits(false);
  }, []);

  const ensureSigner = useCallback(() => {
    if (!signer.isReady || !signer.address || !signer.walletAdapter) {
      const e = new Error(
        'Connect a Solana wallet with a live signer to manage your primary name.',
      );
      setPhase('error');
      setError(e);
      throw e;
    }
  }, [signer]);

  const setPrimaryName = useCallback(
    async ({
      name,
      fundFrom = 'turbo',
    }: SetPrimaryNameInput): Promise<string | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      ensureSigner();
      try {
        setPhase('submitting');
        setStatusMessage(`Setting '${lowered}' as your primary name…`);
        const ario = getWritableARIO(
          signer.getSolanaSigner(),
        ) as unknown as ARIOPrimaryWriteable;
        const res = await ario.setPrimaryName(
          { name: lowered, fundFrom, referrer: APP_NAME },
          {
            ...WRITE_OPTIONS,
            onSigningProgress: (step) =>
              setStatusMessage(progressMessage(step, lowered)),
          },
        );
        setPhase('success');
        setStatusMessage(`Done — '${lowered}' is now your primary name.`);
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return res?.id;
      } catch (err) {
        if (isInsufficientCredits(err)) {
          setInsufficientCredits(true);
          setPhase('error');
          setError(err instanceof Error ? err : new Error(String(err)));
          return undefined;
        }
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [ensureSigner, signer],
  );

  const requestPrimaryName = useCallback(
    async ({
      name,
      fundFrom = 'turbo',
    }: SetPrimaryNameInput): Promise<string | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      ensureSigner();
      try {
        setPhase('submitting');
        setStatusMessage(`Requesting '${lowered}' as your primary name…`);
        const ario = getWritableARIO(
          signer.getSolanaSigner(),
        ) as unknown as ARIOPrimaryWriteable;
        const res = await ario.requestPrimaryName(
          { name: lowered, fundFrom, referrer: APP_NAME },
          WRITE_OPTIONS,
        );
        setPhase('success');
        setStatusMessage(
          `Requested '${lowered}' — the name's owner must approve it.`,
        );
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return res?.id;
      } catch (err) {
        if (isInsufficientCredits(err)) {
          setInsufficientCredits(true);
          setPhase('error');
          setError(err instanceof Error ? err : new Error(String(err)));
          return undefined;
        }
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [ensureSigner, signer],
  );

  const approveRequest = useCallback(
    async ({
      name,
      address,
    }: ApprovePrimaryNameInput): Promise<string | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      ensureSigner();
      try {
        setPhase('submitting');
        setStatusMessage(`Approving '${lowered}'…`);
        // On Solana, approving a primary-name request is an ario-core write
        // (the ANT-level approvePrimaryNameRequest handler is not applicable),
        // so it goes through the ARIO writeable and takes no arioProcessId.
        const ario = getWritableARIO(
          signer.getSolanaSigner(),
        ) as unknown as ARIOPrimaryWriteable;
        const res = await ario.approvePrimaryName(
          { initiator: address, name: lowered },
          WRITE_OPTIONS,
        );
        setPhase('success');
        setStatusMessage(`Approved '${lowered}'.`);
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return res?.id;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [ensureSigner, signer],
  );

  const removePrimary = useCallback(
    async (name: string): Promise<string | undefined> => {
      const lowered = lowerCaseDomain(name);
      setError(undefined);
      setInsufficientCredits(false);
      ensureSigner();
      try {
        setPhase('submitting');
        setStatusMessage(`Removing '${lowered}' as your primary name…`);
        // No high-level SDK path on Solana — build the ario-core remove
        // instructions directly (see utils/arIOConfig.removePrimaryName).
        const id = await removePrimaryName(lowered, signer.getSolanaSigner());
        setPhase('success');
        setStatusMessage(`Removed '${lowered}' as your primary name.`);
        window.dispatchEvent(new CustomEvent('refresh-balance'));
        return id;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setPhase('error');
        setError(normalized);
        throw normalized;
      }
    },
    [ensureSigner, signer],
  );

  return {
    setPrimaryName,
    requestPrimaryName,
    approveRequest,
    removePrimary,
    reset,
    phase,
    statusMessage,
    error,
    insufficientCredits,
    isBusy: phase === 'submitting',
  };
}
