import { useCallback } from 'react';
import { TurboFactory } from '@ardrive/turbo-sdk/web';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useTurboNameCustody } from './useNameCustody';
import { useTurboConfig } from '../../../hooks/useTurboConfig';
import { getWritableANT } from '../../../utils';
import {
  writerKindForWrite,
  type RecordWriter,
} from '../custody/recordWriter';
import {
  antRecordWriter,
  turboRecordWriter,
  type ANTRecordWriteable,
  type TurboRecordClient,
} from '../custody/writers';

/**
 * Resolve the right record writer for a name, by who holds its ANT.
 *
 * Both writers need a live wallet — the difference is what it signs. A
 * user-owned name signs the ANT transaction itself; a Turbo-held one signs a
 * short action-bound message authorising Turbo to do it. So "connect a wallet"
 * is a shared precondition and only the failure past that point differs.
 */
export function useRecordWriter(name: string | undefined, processId: string | undefined) {
  const signer = useArNSTurboSigner();
  const turboConfig = useTurboConfig('solana');
  const { custodyOf, isLoading } = useTurboNameCustody(signer.address ?? undefined);

  const custody = custodyOf(name ?? '');
  const kind = writerKindForWrite(custody);

  const getWriter = useCallback(
    async (antId?: string): Promise<RecordWriter> => {
      if (!signer.isReady || !signer.walletAdapter) {
        throw new Error('Connect a Solana wallet with a live signer to edit records.');
      }
      // `blocked` means custody hasn't resolved yet. Picking a writer here
      // would be a coin flip, and guessing wrong asks the wallet to sign for an
      // asset it doesn't own — a failure the user cannot interpret.
      if (kind === 'blocked') {
        throw new Error('Still checking who holds this name. Try again in a moment.');
      }

      if (kind === 'turbo') {
        const turbo = TurboFactory.authenticated({
          token: 'solana',
          walletAdapter: signer.walletAdapter,
          ...turboConfig,
        }) as unknown as TurboRecordClient;
        return turboRecordWriter(antId ?? processId ?? '', turbo);
      }

      const ant = (await getWritableANT(
        processId as string,
        signer.getSolanaSigner(),
      )) as unknown as ANTRecordWriteable;
      return antRecordWriter(ant);
    },
    [signer, turboConfig, kind, processId],
  );

  return {
    getWriter,
    custody,
    /** True while custody is still unknown — writes must wait, not guess. */
    isResolving: isLoading || kind === 'blocked',
    isCustodial: kind === 'turbo',
  };
}
