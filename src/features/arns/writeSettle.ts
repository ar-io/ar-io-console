import type { UndernameRecord } from './hooks/useUndernames';
import type { ANTDetails } from './hooks/useANTDetails';

/**
 * Settling the page after an ArNS write.
 *
 * A write is confirmed before it returns, but the read straight after it can
 * land on an RPC node a slot or two behind (one RPC URL is several
 * load-balanced nodes). Read once and the stale answer stays until a remount,
 * which is how a saved record went missing until the user left the page.
 *
 * So the page shows the change it just made, then confirms it with a few
 * targeted re-reads of that one query. The budget is deliberately small and
 * slow: at most `SETTLE_DELAYS_MS.length` extra reads per write, stopping at
 * the first one that agrees. A spare RPC call costs more than a few seconds of
 * waiting.
 */

/** When each confirming read runs, measured from the write. */
export const SETTLE_DELAYS_MS: readonly number[] = [3_000, 8_000, 20_000];

/** A record write, as the records table made it. `@` is the apex. */
export type RecordWrite =
  | {
      kind: 'set';
      undername: string;
      change: {
        transactionId: string;
        ttlSeconds: number;
        targetProtocol: number;
        priority?: number;
        displayName?: string;
        logo?: string;
        description?: string;
        keywords?: string[];
      };
    }
  | { kind: 'remove'; undername: string };

/** Undernames compare case-insensitively: the program keys records by the lowercased name. */
const sameUndername = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

type SetChange = Extract<RecordWrite, { kind: 'set' }>['change'];

/** The fields a set write is checked against: the base fields, plus whatever metadata it sent. */
interface RecordFieldsView {
  transactionId?: string;
  ttlSeconds?: number;
  targetProtocol?: number;
  priority?: number;
  displayName?: string;
  logo?: string;
  description?: string;
  keywords?: string[];
}

const sameKeywords = (a: string[] | undefined, b: string[]) =>
  !!a && a.length === b.length && a.every((k, i) => k === b[i]);

/**
 * True if a record shows every field the write sent. Fields the write left
 * out are not checked, so a metadata-only edit is not mistaken for landed
 * just because the target and TTL already matched.
 */
function fieldsMatch(r: RecordFieldsView, c: SetChange): boolean {
  return (
    r.transactionId === c.transactionId &&
    r.ttlSeconds === c.ttlSeconds &&
    (r.targetProtocol ?? 0) === c.targetProtocol &&
    (c.priority === undefined || r.priority === c.priority) &&
    (c.displayName === undefined || r.displayName === c.displayName) &&
    (c.logo === undefined || r.logo === c.logo) &&
    (c.description === undefined || r.description === c.description) &&
    (c.keywords === undefined || sameKeywords(r.keywords, c.keywords))
  );
}

/** True if the records read show the write. An unread list shows nothing. */
export function recordsReflect(
  records: readonly UndernameRecord[] | undefined,
  write: RecordWrite,
): boolean {
  if (!records) return false;
  const found = records.find((r) => sameUndername(r.undername, write.undername));
  if (write.kind === 'remove') return !found;
  return !!found && fieldsMatch(found, write.change);
}

/**
 * The records with the write applied, in the order `useUndernameRecords`
 * returns them: an update keeps its place, a new record goes last, as the
 * next on-chain index would. Metadata the write leaves out is kept.
 */
export function applyRecordWrite(
  records: readonly UndernameRecord[] | undefined,
  write: RecordWrite,
): UndernameRecord[] | undefined {
  if (!records) return undefined;
  if (write.kind === 'remove') {
    return records.filter((r) => !sameUndername(r.undername, write.undername));
  }
  const { change } = write;
  const existing = records.find((r) => sameUndername(r.undername, write.undername));
  const next: UndernameRecord = {
    ...existing,
    undername: existing?.undername ?? write.undername,
    transactionId: change.transactionId,
    ttlSeconds: change.ttlSeconds,
    targetProtocol: change.targetProtocol,
    ...(change.priority !== undefined ? { priority: change.priority } : {}),
    ...(change.displayName !== undefined ? { displayName: change.displayName } : {}),
    ...(change.logo !== undefined ? { logo: change.logo } : {}),
    ...(change.description !== undefined ? { description: change.description } : {}),
    ...(change.keywords !== undefined ? { keywords: change.keywords } : {}),
  } as UndernameRecord;
  return existing
    ? records.map((r) => (r === existing ? next : r))
    : [...records, next];
}

/** True if the ANT details show the apex write. */
export function apexReflects(ant: ANTDetails | undefined, write: RecordWrite): boolean {
  if (!ant || write.kind !== 'set') return false;
  return fieldsMatch(
    {
      transactionId: ant.target,
      ttlSeconds: ant.ttlSeconds,
      targetProtocol: ant.targetProtocol,
      priority: ant.priority,
      displayName: ant.recordDisplayName,
      logo: ant.recordLogo,
      description: ant.recordDescription,
      keywords: ant.recordKeywords,
    },
    write.change,
  );
}

/** The ANT details with the apex write applied to the base record fields only. */
export function applyApexWrite(
  ant: ANTDetails | undefined,
  write: RecordWrite,
): ANTDetails | undefined {
  if (!ant || write.kind !== 'set') return ant;
  const { change } = write;
  return {
    ...ant,
    target: change.transactionId,
    ttlSeconds: change.ttlSeconds,
    targetProtocol: change.targetProtocol,
    ...(change.priority !== undefined ? { priority: change.priority } : {}),
    ...(change.displayName !== undefined ? { recordDisplayName: change.displayName } : {}),
    ...(change.logo !== undefined ? { recordLogo: change.logo } : {}),
    ...(change.description !== undefined ? { recordDescription: change.description } : {}),
    ...(change.keywords !== undefined ? { recordKeywords: change.keywords } : {}),
  };
}

/** A controller added or removed. */
export type ControllerWrite = { kind: 'add' | 'remove'; address: string };

interface ControllersLike {
  owner: string;
  controllers: string[];
}

/** True if the controllers read show the write. */
export function controllersReflect(
  state: ControllersLike | undefined,
  write: ControllerWrite,
): boolean {
  if (!state) return false;
  const has = state.controllers.includes(write.address);
  return write.kind === 'add' ? has : !has;
}

/** The controllers with the write applied. */
export function applyControllerWrite<T extends ControllersLike>(
  state: T | undefined,
  write: ControllerWrite,
): T | undefined {
  if (!state) return undefined;
  if (write.kind === 'add') {
    return state.controllers.includes(write.address)
      ? state
      : { ...state, controllers: [...state.controllers, write.address] };
  }
  return { ...state, controllers: state.controllers.filter((c) => c !== write.address) };
}

/**
 * What to do with one confirming read.
 *
 *   accept   use the read (it agrees, or it is the last attempt: after that the
 *            chain is the truth even if it disagrees)
 *   retry    keep the local change and read again at the next delay
 *   give-up  the last read failed; keep what is shown, read nothing more
 */
export function nextSettleStep({
  attempt,
  reflected,
  readFailed,
}: {
  attempt: number;
  reflected: boolean;
  readFailed: boolean;
}): 'accept' | 'retry' | 'give-up' {
  if (reflected) return 'accept';
  const last = attempt >= SETTLE_DELAYS_MS.length - 1;
  if (!last) return 'retry';
  return readFailed ? 'give-up' : 'accept';
}
