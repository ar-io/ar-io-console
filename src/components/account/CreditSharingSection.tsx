import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { useShareBalance } from '@/hooks/useShareBalance';
import { useWalletTurboClient } from '@/hooks/useWalletTurboClient';
import { shareFailureMessage } from '@/utils/shareableCredits';
import { buttonClass } from '@/components/button';
import ShareCreditsList from '@/components/panels/ShareCreditsList';

const DESCRIPTION = 'Wallets you let spend your credits, and wallets that let you spend theirs.';

function Title({ description }: { description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/20">
        <Share2 className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-lg font-extrabold text-foreground">Credit sharing</h3>
        <p className="text-sm text-foreground/80">{description}</p>
      </div>
    </div>
  );
}

/**
 * Credit sharing on the Account page: the same list, grouping and Revoke as
 * Share Credits (`ShareCreditsList`), reading the same cached balance
 * (`useShareBalance`), so the two pages can't disagree about a share. A
 * wallet with no shares in either direction gets one line instead of two
 * empty tabs.
 */
export default function CreditSharingSection() {
  const { data, isError, isLoading, refetch } = useShareBalance();
  const createTurboClient = useWalletTurboClient();

  const handleRevoke = async (revokedAddress: string) => {
    try {
      const turbo = await createTurboClient();
      await turbo.revokeCredits({ revokedAddress });
    } catch (err) {
      console.error('Revoke credits error:', err);
      refetch();
      throw new Error(shareFailureMessage(err, 'revoke'));
    }
    window.dispatchEvent(new CustomEvent('refresh-balance'));
    await refetch();
  };

  const shareLink = (
    <Link to="/share" className={`${buttonClass('secondary', 'sm')} self-start sm:self-auto`}>
      Share credits
    </Link>
  );

  const card = 'rounded-2xl border border-border/20 bg-card p-4 sm:p-6';

  // Only when nothing has loaded: a failed background refetch (focus,
  // refresh-balance, the one after a failed revoke) keeps the rows on screen,
  // as Share Credits does, so a revoke's own error message stays visible.
  if (isError && !data) {
    return (
      <section aria-label="Credit sharing" className={card}>
        <Title description={DESCRIPTION} />
        <p className="mt-4 text-sm text-error">
          Couldn&apos;t load your shares.{' '}
          <button type="button" onClick={() => refetch()} className="font-medium text-primary hover:underline">
            Try again
          </button>
        </p>
      </section>
    );
  }

  if (isLoading || !data) {
    return (
      <section aria-label="Credit sharing" className={card}>
        <Title description={DESCRIPTION} />
        <div className="mt-4 h-12 animate-pulse rounded-2xl bg-foreground/10 sm:max-w-md" />
      </section>
    );
  }

  if (data.given.length === 0 && data.received.length === 0) {
    return (
      <section
        aria-label="Credit sharing"
        className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}
      >
        <Title description="You haven’t shared credits with anyone, and no one has shared with you." />
        {shareLink}
      </section>
    );
  }

  return (
    <ShareCreditsList
      layout="section"
      label="Credit sharing"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Title description={DESCRIPTION} />
          {shareLink}
        </div>
      }
      given={data.given}
      received={data.received}
      sharedOutWinc={data.sharedOutWinc}
      receivedWinc={data.receivedWinc}
      onRevoke={handleRevoke}
    />
  );
}
