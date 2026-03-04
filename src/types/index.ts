export interface ArNSName {
  name: string;           // e.g., "my-blog" or "xn--gmq235b10p"
  displayName: string;    // Decoded punycode name for UI
  processId: string;      // ANT process ID
  currentTarget?: string; // Current transaction ID (fetched on-demand)
  lastUpdated?: Date;
  undernames?: string[];  // Available undernames (fetched on-demand)
  ttl?: number;           // TTL in seconds for base name (@)
  undernameTTLs?: Record<string, number>; // TTL for each undername
}