import type { SettlementRoute } from './settlementRoute';
import { formatHeldBalance } from './formatBalance';

/**
 * What the paying source holds, worded for the cost summary's "Your balance"
 * row: "119.43K ARIO · 0.25 SOL", "3.11 credits", "12.5 USDC".
 *
 * The ARIO route names both tokens because it spends both: the ARIO for the
 * name and the SOL for the network costs, and either one can be what falls
 * short. Its ARIO is the chosen funding source's, since that is what the
 * purchase draws on.
 *
 * `undefined` when there is nothing to show: a card has no balance, and a
 * signed-out visitor has none we can read. An unknown balance says so rather
 * than reading as zero.
 */
export function heldLabel({
  route,
  signedIn,
  loading,
  balances,
  token,
}: {
  route: SettlementRoute;
  signedIn: boolean;
  loading: boolean;
  balances: {
    liquidArio: number;
    stakedArio: number;
    totalArio: number;
    sol: number | undefined;
    credits: number;
  };
  /** The token a top-up spends, when the route is one. */
  token?: { held: number | undefined; label: string };
}): string | undefined {
  if (!signedIn || route.kind === 'card') return undefined;
  if (loading) return '…';
  switch (route.kind) {
    case 'ario': {
      const ario =
        route.fundFrom === 'stakes'
          ? balances.stakedArio
          : route.fundFrom === 'any'
            ? balances.totalArio
            : balances.liquidArio;
      const sol =
        balances.sol === undefined
          ? 'SOL unavailable'
          : `${formatHeldBalance(balances.sol)} SOL`;
      return `${formatHeldBalance(ario)} ARIO · ${sol}`;
    }
    case 'credits':
      return `${formatHeldBalance(balances.credits)} credits`;
    case 'topup':
      if (!token) return undefined;
      return token.held === undefined
        ? `${token.label} unavailable`
        : `${formatHeldBalance(token.held)} ${token.label}`;
  }
}
