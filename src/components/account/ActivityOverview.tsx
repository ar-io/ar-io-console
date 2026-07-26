import { Upload, Rocket, ArrowRight, ExternalLink } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getArweaveUrl } from '../../utils';
import { useNavigate } from 'react-router-dom';

/** Compact date for activity rows, e.g. "Jul 23". */
function shortDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ActivityOverview() {
  const { uploadHistory, deployHistory } = useStore();
  const navigate = useNavigate();

  // Helper to find ArNS association for a manifest
  const getArNSAssociation = (manifestId: string) => {
    return deployHistory.find(
      (record) => record.type === 'arns-update' && record.manifestId === manifestId,
    );
  };

  // Group deploy results by manifest ID (same as DeploySitePanel)
  const deploymentGroups: { [manifestId: string]: { manifest?: any; files?: any } } = {};

  deployHistory.forEach((result) => {
    const manifestId = result.manifestId || result.id;
    if (!manifestId) return;

    if (!deploymentGroups[manifestId]) {
      deploymentGroups[manifestId] = {};
    }

    if (result.type === 'manifest') {
      deploymentGroups[manifestId].manifest = result;
    } else if (result.type === 'files') {
      deploymentGroups[manifestId].files = result;
    }
  });

  const deployments = Object.entries(deploymentGroups);
  const recentUploads = uploadHistory.slice(0, 5);
  const recentDeployments = deployments.slice(0, 5);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Recent Uploads */}
      <div className="rounded-2xl border border-border/20 bg-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-foreground/20">
            <Upload className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Uploads</h3>
            <p className="text-sm text-foreground/80">Your latest files</p>
          </div>
        </div>

        {uploadHistory.length === 0 ? (
          <div className="py-6 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-foreground/30" />
            <p className="text-sm text-foreground/80">No uploads yet</p>
          </div>
        ) : (
          <>
            <div>
              {recentUploads.map((upload, index) => (
                <div
                  key={`${upload.id}-${index}`}
                  className="flex items-center gap-3 border-t border-border/20 py-3 text-sm first:border-t-0"
                >
                  <Upload className="h-4 w-4 flex-shrink-0 text-foreground/60" />
                  <span className="min-w-0 flex-1 truncate text-foreground" title={upload.fileName}>
                    {upload.fileName || `${upload.id.substring(0, 8)}…`}
                  </span>
                  <span className="flex-shrink-0 text-xs text-foreground/60">
                    {shortDate(upload.timestamp)}
                  </span>
                  <a
                    href={getArweaveUrl(upload.id, upload.dataCaches)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-foreground/60 transition-colors hover:text-foreground"
                    title="View file"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
            {uploadHistory.length > 5 && (
              <button
                onClick={() => navigate('/upload')}
                className="mt-3 flex w-full items-center justify-center gap-2 border-t border-border/20 pt-3 text-sm font-medium text-primary transition-colors hover:underline"
              >
                View all uploads <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Recent Deployments */}
      <div className="rounded-2xl border border-border/20 bg-card p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/20 bg-foreground/20">
            <Rocket className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Deployments</h3>
            <p className="text-sm text-foreground/80">Your latest sites</p>
          </div>
        </div>

        {deployments.length === 0 ? (
          <div className="py-6 text-center">
            <Rocket className="mx-auto mb-2 h-8 w-8 text-foreground/30" />
            <p className="text-sm text-foreground/80">No deployments yet</p>
          </div>
        ) : (
          <>
            <div>
              {recentDeployments.map(([manifestId, group]) => {
                const arnsAssociation = getArNSAssociation(manifestId);
                const arnsName = arnsAssociation?.arnsName;
                const prefix = arnsAssociation?.undername ? `${arnsAssociation.undername}_` : '';
                const displayName = arnsName ? `${prefix}${arnsName}` : `${manifestId.substring(0, 8)}…`;
                const visitUrl = arnsName
                  ? `https://${prefix}${arnsName}.ar.io`
                  : getArweaveUrl(manifestId, group.manifest?.receipt?.dataCaches);

                return (
                  <div
                    key={manifestId}
                    className="flex items-center gap-3 border-t border-border/20 py-3 text-sm first:border-t-0"
                  >
                    <Rocket className="h-4 w-4 flex-shrink-0 text-foreground/60" />
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span
                        className={`truncate ${arnsName ? 'font-mono text-foreground' : 'font-mono text-foreground/80'}`}
                        title={displayName}
                      >
                        {displayName}
                      </span>
                      {arnsAssociation?.arnsStatus === 'failed' && (
                        <span className="flex-shrink-0 text-xs text-error">(failed)</span>
                      )}
                      {arnsAssociation?.arnsStatus === 'pending' && (
                        <span className="flex-shrink-0 text-xs text-warning">(updating…)</span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-xs text-foreground/60">
                      {shortDate(group.manifest?.timestamp)}
                    </span>
                    <a
                      href={visitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-foreground/60 transition-colors hover:text-foreground"
                      title="Visit site"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
            {deployments.length > 5 && (
              <button
                onClick={() => {
                  navigate('/deployments');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="mt-3 flex w-full items-center justify-center gap-2 border-t border-border/20 pt-3 text-sm font-medium text-primary transition-colors hover:underline"
              >
                View all deployments <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
