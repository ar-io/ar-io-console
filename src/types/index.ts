export interface ArNSName {
  name: string;           // e.g., "my-blog" or "xn--gmq235b10p"
  displayName: string;    // Decoded punycode name for UI
  processId: string;      // ANT process ID
  currentTarget?: string; // Current transaction ID (fetched on-demand)
  lastUpdated?: Date;
  undernames?: string[];  // Available undernames (fetched on-demand)
  ttl?: number;           // TTL in seconds for base name (@)
  undernameTTLs?: Record<string, number>; // TTL for each undername
  type?: 'lease' | 'permabuy'; // Registration type (permabuy never expires)
  endTimestamp?: number;  // Lease end (ms epoch); absent for permabuy
  /**
   * Turbo holds this name's ANT (a custodial card purchase).
   *
   * Set by `custody/mergeCustodialNames`, which folds names Turbo owns on the
   * buyer's behalf into "your names" — the ACL lists the ANT's OWNER, so a
   * custodial name is otherwise absent from it entirely.
   */
  custodial?: boolean;
}