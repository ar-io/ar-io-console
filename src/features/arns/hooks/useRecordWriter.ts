import { useCallback } from 'react';

import { useArNSTurboSigner } from './useArNSTurboSigner';
import { useCustodyOwnerClient } from './useCustodyOwnerClient';
import { useTurboNameCustody } from './useNameCustody';
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
  const { getClient } = useCustodyOwnerClient();
  const { custodyOf, isLoading } = useTurboNameCustody();

  const custody = custodyOf(name ?? '');
  const kind = writerKindForWrite(custody);

  const getWriter = useCallback(
    async (antId?: string): Promise<RecordWriter> => {
      /*
        A Turbo-held name is signed by its OWNER, who may hold no Solana wallet
        at all; a user-owned name needs the Solana signer that owns the ANT. The
        precondition differs by writer, so it is checked per branch below rather
        than demanding a Solana adapter from everyone up front.
      */
      if (kind !== 'turbo' && (!signer.isReady || !signer.walletAdapter)) {
        throw new Error('Connect a Solana wallet with a live signer to edit records.');
      }
      // `blocked` means custody hasn't resolved yet. Picking a writer here
      // would be a coin flip, and guessing wrong asks the wallet to sign for an
      // asset it doesn't own — a failure the user cannot interpret.
      if (kind === 'blocked') {
        throw new Error('Still checking who holds this name. Try again in a moment.');
      }

      if (kind === 'turbo') {
        const turbo = (await getClient()) as unknown as TurboRecordClient;
        return turboRecordWriter(antId ?? processId ?? '', turbo);
      }

      const ant = (await getWritableANT(
        processId as string,
        signer.getSolanaSigner(),
      )) as unknown as ANTRecordWriteable;
      return antRecordWriter(ant);
    },
    [getClient, signer, kind, processId],
  );

  return {
    getWriter,
    custody,
    /** True while custody is still unknown — writes must wait, not guess. */
    isResolving: isLoading || kind === 'blocked',
    isCustodial: kind === 'turbo',
  };
}
