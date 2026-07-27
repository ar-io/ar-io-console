import { Calendar, ExternalLink, Globe, AlertTriangle } from 'lucide-react';
import { ArNSName } from '@/types';
import { daysUntil, EXPIRY_WARNING_DAYS } from '@/utils/domainExpiry';

const OwnedName = ({ domain }: { domain: ArNSName }) => {
  // Expiry now rides along on the owned-names batch (see useOwnedArNSNames) — no
  // per-card fetch needed. Permabuy names never expire.
  const isLease = domain.type !== 'permabuy';
  const days =
    isLease && typeof domain.endTimestamp === 'number'
      ? daysUntil(domain.endTimestamp, Date.now())
      : null;
  const expiringSoon = days !== null && days <= EXPIRY_WARNING_DAYS;

  const ownershipText =
    domain.type === 'permabuy'
      ? 'Permanently owned'
      : days === null
        ? 'Leased'
        : days < 0
          ? `Lease expired ${-days} day${-days === 1 ? '' : 's'} ago`
          : `Lease expires in ${days} day${days === 1 ? '' : 's'}`;

  return (
    <div
      className={`bg-card rounded-2xl border p-4 ${
        expiringSoon ? 'border-warning/40' : 'border-border/20'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Domain Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading font-bold text-lg text-foreground truncate">{domain.displayName}.ar.io</h3>
                {expiringSoon && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    {days !== null && days < 0 ? 'Expired' : days === 0 ? 'Expires today' : `Expires in ${days}d`}
                  </span>
                )}
              </div>
              {domain.displayName !== domain.name && (
                <p className="text-xs text-foreground/80">Raw name: {domain.name}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            {domain.lastUpdated && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-foreground/80" />
                <span className="text-foreground/80">Registered: {domain.lastUpdated.toLocaleDateString()}</span>
              </div>
            )}

            <span className={`text-xs ${expiringSoon ? 'text-warning font-medium' : 'text-foreground/80'}`}>
              {ownershipText}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
          {expiringSoon && (
            <a
              href={`https://arns.ar.io/#/manage/names/${domain.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-warning text-white rounded-full font-medium hover:opacity-90 transition-opacity"
            >
              <AlertTriangle className="w-4 h-4" />
              Renew
            </a>
          )}
          <a
            href={`https://${domain.name}.ar.io`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Visit
          </a>
          <a
            href={`https://arns.ar.io/#/manage/names/${domain.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border/20 rounded-full text-foreground hover:bg-card transition-colors"
          >
            <Globe className="w-4 h-4" />
            Manage
          </a>
        </div>
      </div>
    </div>
  );
};

export default OwnedName;
