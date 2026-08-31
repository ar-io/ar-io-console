import { useState } from 'react';
import { Info, Loader2, Plus, Trash2, Users, XCircle } from 'lucide-react';

import { ArNSName } from '@/types';
import BaseModal from '../../../components/modals/BaseModal';
import ModalHeader from '../../../components/modals/ModalHeader';
import {
  MAX_CONTROLLERS,
  isControllerLimitReached,
  validateNewController,
} from '../utils';
import {
  useControllersState,
  useControllerWrites,
} from '../hooks/useControllers';

interface ControllersModalProps {
  domain: ArNSName;
  onClose: () => void;
  /** Called after any controller write settles, so the caller can refresh. */
  onSuccess?: () => void;
}

const inputCls =
  'w-full rounded-2xl border border-border/20 bg-card p-3 text-sm text-foreground focus:border-primary disabled:opacity-50';

/**
 * View, add, and remove ANT controllers for an owned name. Controllers can
 * manage this name's records/metadata but cannot transfer or sell it. Each
 * add/remove is ONE Solana signature; the list refetches after each write.
 */
export default function ControllersModal({
  domain,
  onClose,
  onSuccess,
}: ControllersModalProps) {
  const state = useControllersState(domain.processId, true);
  const { addController, removeController, busyKey, error, isBusy } =
    useControllerWrites();

  const controllers = state.data?.controllers ?? [];
  const owner = state.data?.owner;
  const atMax = isControllerLimitReached(controllers);

  const [addOpen, setAddOpen] = useState(false);
  const [newController, setNewController] = useState('');

  const afterWrite = async () => {
    await state.refetch();
    onSuccess?.();
  };

  // Validate the trimmed value — the same one passed to `addController` — so the
  // gate and the write agree on leading/trailing whitespace.
  const validation = validateNewController(
    newController.trim(),
    owner,
    controllers,
  );
  const canAdd = validation.ok && !isBusy;

  const handleAdd = async () => {
    if (atMax) return;
    try {
      await addController(domain.processId, newController.trim());
      setNewController('');
      setAddOpen(false);
      await afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  const handleRemove = async (addr: string) => {
    try {
      await removeController(domain.processId, addr);
      await afterWrite();
    } catch {
      /* surfaced via error */
    }
  };

  return (
    <BaseModal onClose={onClose} showCloseButton>
      <div className="w-[92vw] max-w-lg p-4 sm:p-5">
        <ModalHeader
          icon={Users}
          title={
            <>
              Controllers for{' '}
              <span className="break-all font-mono text-primary">
                {domain.displayName}.ar.io
              </span>
            </>
          }
          description="Who can edit this name's records"
        />

        {/*
          Turbo appears in this list on every name bought here, because buying
          adds it in the same approval that mints the name. That is worth
          explaining once, plainly, next to the button that removes it:
          revocability is the whole reason the arrangement is safe to accept,
          so burying it or dressing Remove up as destructive would undercut the
          claim that the name is genuinely the owner's.
        */}
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-3 text-xs text-foreground/70">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
          Helpers can edit this name&apos;s records but can never transfer or
          sell it. Turbo was added when you bought the name so record changes
          stay quick — removing it is free and doesn&apos;t lock you out.
          Adding or removing one is a single wallet approval, and needs no SOL.
        </div>

        {/* Existing controllers */}
        {state.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading controllers…
          </div>
        ) : state.isError ? (
          <div className="flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>Couldn&apos;t load controllers for this name.</span>
          </div>
        ) : controllers.length === 0 ? (
          <p className="py-4 text-sm text-foreground/60">
            No helpers yet. You can always manage this name yourself.
          </p>
        ) : (
          <ul className="mb-2 space-y-2">
            {controllers.map((addr) => {
              const rowBusy = busyKey === addr;
              return (
                <li
                  key={addr}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-border/20 bg-card p-3"
                >
                  <span className="truncate font-mono text-sm text-foreground">
                    {addr}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-3 text-sm">
                    {rowBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
                    ) : (
                      <button
                        onClick={() => handleRemove(addr)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 text-error hover:underline disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add controller */}
        {atMax ? (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border/20 bg-card p-3 text-xs text-foreground/70">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
            Maximum of {MAX_CONTROLLERS} controllers reached. Remove one before
            adding another.
          </div>
        ) : addOpen ? (
          <div className="mt-3 rounded-2xl border border-primary/30 bg-card p-4">
            <label
              htmlFor="new-controller-address"
              className="mb-1 block text-sm font-medium"
            >
              Controller address
            </label>
            <input
              id="new-controller-address"
              className={`${inputCls} font-mono`}
              value={newController}
              onChange={(e) => setNewController(e.target.value)}
              placeholder="Controller Solana address"
              spellCheck={false}
              disabled={isBusy}
            />
            {!validation.ok && validation.reason === 'invalid' && (
              <p className="mt-1 text-xs text-error">
                Enter a valid Solana wallet address.
              </p>
            )}
            {!validation.ok && validation.reason === 'owner' && (
              <p className="mt-1 text-xs text-error">
                This wallet already owns the name, so it can already manage
                everything.
              </p>
            )}
            {!validation.ok && validation.reason === 'duplicate' && (
              <p className="mt-1 text-xs text-error">
                That address is already a controller.
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={!canAdd}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyKey === newController.trim() ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add controller
                  </>
                )}
              </button>
              <button
                onClick={() => setAddOpen(false)}
                disabled={isBusy}
                className="text-sm text-foreground/60 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddOpen(true)}
            disabled={isBusy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add controller
          </button>
        )}

        {/* Errors */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">
            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error.message}</span>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
