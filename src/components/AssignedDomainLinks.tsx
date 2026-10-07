import { Link } from 'react-router-dom';
import { ExternalLink, Settings } from 'lucide-react';

import { assignedLabel, useArnsHost } from '@/hooks/useArnsHost';
import { actionButtonClass } from './actionButton';

/**
 * What to do next after a name is pointed at an upload, capture or deploy:
 * open it, or go to the name's page to manage it. Shown inside the success
 * message so the result is one click away.
 */
export default function AssignedDomainLinks({
  name,
  undername,
}: {
  name: string;
  undername?: string;
}) {
  const host = useArnsHost();
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a
        href={`https://${assignedLabel(name, undername)}.${host}`}
        target="_blank"
        rel="noopener noreferrer"
        className={actionButtonClass()}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Visit
      </a>
      <Link to={`/domains/${encodeURIComponent(name)}`} className={actionButtonClass()}>
        <Settings className="h-3.5 w-3.5" />
        Manage {name}
      </Link>
    </div>
  );
}
