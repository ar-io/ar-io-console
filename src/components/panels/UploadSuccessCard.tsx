import { Check, Copy, Globe, Upload as UploadIcon } from 'lucide-react';

import { useState } from 'react';

import CopyButton from '../CopyButton';
import { formatBytes, getArweaveUrl } from '../../utils';

interface UploadSuccessResult {
  id: string;
  dataCaches: string[];
  fileName?: string;
  fileSize?: number;
  contentType?: string;
  arnsName?: string;
  undername?: string;
}

interface UploadSuccessCardProps {
  result: UploadSuccessResult;
  /** Open AssignDomainModal for this upload. */
  onConnectDomain: () => void;
  /** Clear the success state and return to the picker. */
  onUploadAnother: () => void;
}

/**
 * The result block for a single-file upload: the permanent link, plus the
 * naming step Upload never offered.
 *
 * Two gaps this closes. First, a finished upload used to collapse to a one-line
 * toast and an emptied file list, so the URL — the entire point — was reachable
 * only inside the Recent panel, which is collapsed by default. Second, Deploy
 * and Capture both prompt for an ArNS name; Upload's only naming path was an
 * unlabelled globe icon on a Recent row, so most people never found it.
 *
 * Deliberately single-file only. With several uploads there is no one URL to
 * feature and no single target for a name, so the multi-file path keeps the
 * summary toast and simply expands Recent.
 *
 * The panel header above this handles the success announcement (matching
 * Deploy's header swap), so this block leads with content rather than repeating
 * a second "it worked" banner.
 */
export default function UploadSuccessCard({
  result,
  onConnectDomain,
  onUploadAnother,
}: UploadSuccessCardProps) {
  const [copiedId, setCopiedId] = useState(false);
  const url = getArweaveUrl(result.id, result.dataCaches);
  const domain = result.arnsName
    ? `${result.undername ? `${result.undername}_` : ''}${result.arnsName}.ar.io`
    : null;

  return (
    <div className="mb-4 sm:mb-6 rounded-2xl border border-border/20 bg-card p-4 sm:p-6">
      <div>
        <div className="min-w-0 flex-1">
          {result.fileName && (
            <div
              className="mb-1 truncate font-medium text-foreground"
              title={result.fileName}
            >
              {result.fileName}
            </div>
          )}
          <div className="mb-3 text-xs text-foreground/80">
            {result.fileSize !== undefined && formatBytes(result.fileSize)}
            {result.contentType && ` · ${result.contentType}`}
          </div>

          {domain && (
            <div className="mb-3">
              <div className="mb-1 text-xs text-foreground/80">Domain</div>
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                {domain}
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-2xl border border-border/20 bg-background px-3 py-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline"
            >
              {url}
            </a>
            <CopyButton textToCopy={url} />
          </div>
        </div>
      </div>

      {/* The domain CTA carries its own explanation, inside the tinted block
          ArNSAssociationPanel uses on Deploy. Keeping the two together stops the
          copy describing one button from sitting under a whole row of them, and
          reuses Deploy's wording so naming reads the same on every surface. */}
      {!domain && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium text-foreground">Add a domain</div>
              <p className="text-sm text-foreground/80">
                Give it a name people remember
              </p>
            </div>
          </div>
          <button
            onClick={onConnectDomain}
            className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Connect Domain
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.id);
              setCopiedId(true);
              setTimeout(() => setCopiedId(false), 2000);
            } catch (err) {
              console.error('Failed to copy:', err);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground"
        >
          {copiedId
            ? <Check className="h-4 w-4 text-success" aria-hidden="true" />
            : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copiedId ? 'Copied' : 'Copy TX ID'}
        </button>
        <button
          onClick={onUploadAnother}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
        >
          <UploadIcon className="h-4 w-4" />
          Upload Another
        </button>
      </div>
    </div>
  );
}
