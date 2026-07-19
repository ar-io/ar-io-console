/**
 * usePagePublish — orchestrates publishing a Pages page:
 *   validate -> render HTML -> uploadFile (credits / JIT) -> record version ->
 *   (optional) repoint ArNS. A thin wrapper over the pure `publish/*` helpers so
 *   the determinism-sensitive logic stays node-testable.
 *
 * Self-referential permalink strategy (PRD §7.12) — a page cannot know its own tx
 * id before upload, so we NEVER embed a guessed `ar://<txid>` for the verify
 * affordance:
 *   - If the page has (or is being given) an ArNS name, the verify block AND the
 *     render context point at that stable name (`ar://<name>`), which survives
 *     re-publishes and rollbacks and is a real, resolvable permalink.
 *   - If there is no ArNS name, we leave `selfTxId` undefined and neutralise any
 *     placeholder `ar://<txid>` verify url (e.g. a template seed's) to `#`, so the
 *     affordance is omitted rather than linking to a wrong/fake tx.
 */

import { useCallback, useRef, useState } from 'react';
import { useStore, type PageVersion } from '@/store/useStore';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useOwnedArNSNames } from '@/hooks/useOwnedArNSNames';
import { useLinkedSolanaWallet } from '@/hooks/useLinkedSolanaWallet';
import type { SupportedTokenType } from '@/constants';
import { validatePageDef, type PageDef } from '../schema';
import { renderPageHtml } from '../render/renderPageHtml';
import { buildPageTags, type Tag } from '../publish/tags';
import { buildPageFile, computeDefHash, slugify } from '../publish/pageFile';
import { renderCtxFor } from '../publish/renderCtx';
import { arnsLabel, prepareDefForPublish, type ArnsTarget } from '../publish/permalink';

export type PublishStage =
  | 'idle'
  | 'rendering'
  | 'uploading'
  | 'updating-arns'
  | 'complete'
  | 'error';

export type PublishArns = ArnsTarget;

export interface PublishOptions {
  jitEnabled?: boolean;
  selectedJitToken?: SupportedTokenType;
  customTags?: Tag[];
  /** When set (and Solana access available), repoint this name/undername at the new tx. */
  arns?: PublishArns;
  note?: string;
}

export interface PublishResult {
  ok: boolean;
  /** True when the def hash matched the current version — nothing was uploaded. */
  noChanges?: boolean;
  pageId: string;
  version?: number;
  txId?: string;
  size?: number;
  arnsUpdated?: boolean;
  arnsError?: string;
  error?: string;
}

export function usePagePublish() {
  const getCurrentConfig = useStore((s) => s.getCurrentConfig);
  const configMode = useStore((s) => s.configMode);
  const getPage = useStore((s) => s.getPage);
  const addPageVersion = useStore((s) => s.addPageVersion);
  const updatePageArNS = useStore((s) => s.updatePageArNS);
  const { uploadFile } = useFileUpload();
  const { updateArNSRecord } = useOwnedArNSNames();
  const { hasArNSAccess } = useLinkedSolanaWallet();

  const [publishing, setPublishing] = useState(false);
  const [stage, setStage] = useState<PublishStage>('idle');
  const [error, setError] = useState<string | null>(null);
  // Synchronous single-flight guard: `publishing` state is async, so a fast
  // re-entrant call (e.g. re-opening the modal mid-upload) could otherwise start a
  // second upload/charge before the state update lands. This guarantees at most one
  // upload per publish regardless of UI timing.
  const inFlightRef = useRef(false);

  const publish = useCallback(
    async (def: PageDef, options: PublishOptions = {}): Promise<PublishResult> => {
      if (inFlightRef.current) {
        return { ok: false, pageId: def?.id ?? '', error: 'A publish is already in progress.' };
      }
      inFlightRef.current = true;
      setError(null);
      setPublishing(true);
      setStage('rendering');
      try {
        const validated = validatePageDef(def);
        const pageId = validated.id;
        const defHash = computeDefHash(validated);

        // Smart dedup: identical content since the current version => nothing to publish.
        const existing = getPage(pageId);
        const currentHash =
          existing?.versions.find((v) => v.version === existing.currentVersion)?.defHash ??
          existing?.versions[0]?.defHash;
        if (currentHash && currentHash === defHash) {
          setStage('idle');
          setPublishing(false);
          return { ok: false, noChanges: true, pageId };
        }

        const nextVersion = (existing?.currentVersion ?? 0) + 1;

        // Permalink target = a name being assigned now, else the page's existing
        // name, else a name already declared on the def. Repoint (below) only runs
        // for an explicitly-passed `options.arns`.
        const permalink: PublishArns | undefined =
          options.arns ??
          (existing?.arns
            ? { name: existing.arns.name, undername: existing.arns.undername }
            : validated.arnsName
              ? { name: validated.arnsName }
              : undefined);
        const permalinkLabel = permalink ? arnsLabel(permalink) : undefined;

        const config = getCurrentConfig();
        // selfTxId intentionally omitted — unknown before upload (see module doc).
        const ctx = renderCtxFor(validated, { ...config, configMode }, { arnsName: permalinkLabel });

        const publishDef = prepareDefForPublish(validated, permalinkLabel);
        const html = renderPageHtml(publishDef, ctx);
        const file = buildPageFile(html, slugify(validated.title));

        setStage('uploading');
        const tags = buildPageTags(validated, nextVersion, options.customTags ?? []);
        const result = await uploadFile(file, {
          customTags: tags,
          jitEnabled: options.jitEnabled,
          selectedJitToken: options.selectedJitToken,
        });

        const version: PageVersion = {
          version: nextVersion,
          txId: result.id,
          size: file.size,
          defHash,
          timestamp: Date.now(),
          ...(options.note ? { note: options.note } : {}),
        };
        // Store the validated *source* def (the editor's working copy); the
        // published HTML embeds the prepared def.
        addPageVersion(pageId, version, validated);
        window.dispatchEvent(new CustomEvent('refresh-balance'));

        // Optional ArNS repoint. Publish already succeeded, so any failure here is
        // a partial success — surfaced via `arnsError`, never a thrown publish.
        let arnsUpdated = false;
        let arnsError: string | undefined;
        if (options.arns) {
          if (!hasArNSAccess) {
            arnsError = 'Link a Solana wallet to assign a domain.';
          } else {
            setStage('updating-arns');
            try {
              const res = await updateArNSRecord(
                options.arns.name,
                result.id,
                options.arns.undername,
              );
              if (res.success) {
                arnsUpdated = true;
                updatePageArNS(pageId, {
                  name: options.arns.name,
                  undername: options.arns.undername,
                  targetTxId: result.id,
                  arnsTxId: res.transactionId,
                });
                // Stamp the just-added version with the repoint tx (idempotent).
                addPageVersion(
                  pageId,
                  { ...version, arnsRepointTxId: res.transactionId },
                  validated,
                );
              } else {
                arnsError = res.error || 'Failed to update ArNS record.';
              }
            } catch (e) {
              arnsError = e instanceof Error ? e.message : 'Failed to update ArNS record.';
            }
          }
        }

        setStage('complete');
        setPublishing(false);
        if (arnsError) setError(arnsError);
        return {
          ok: true,
          pageId,
          version: nextVersion,
          txId: result.id,
          size: file.size,
          arnsUpdated,
          arnsError,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to publish page.';
        setError(message);
        setStage('error');
        setPublishing(false);
        return { ok: false, pageId: def?.id ?? '', error: message };
      } finally {
        inFlightRef.current = false;
      }
    },
    [getCurrentConfig, configMode, getPage, addPageVersion, updatePageArNS, uploadFile, updateArNSRecord, hasArNSAccess],
  );

  /**
   * Rollback / re-point: point the page's ArNS name at a prior version's tx
   * (reuses `updateArNSRecord`). Requires a domain + Solana access (PRD §7.7).
   */
  const repointArNS = useCallback(
    async (pageId: string, versionNumber: number): Promise<{ success: boolean; error?: string }> => {
      const page = getPage(pageId);
      if (!page) return { success: false, error: 'Page not found.' };
      if (!page.arns) return { success: false, error: 'No domain assigned to this page.' };
      const ver = page.versions.find((v) => v.version === versionNumber);
      if (!ver) return { success: false, error: 'Version not found.' };
      if (!hasArNSAccess) return { success: false, error: 'Link a Solana wallet to update your domain.' };

      setError(null);
      setPublishing(true);
      setStage('updating-arns');
      try {
        const res = await updateArNSRecord(page.arns.name, ver.txId, page.arns.undername);
        if (res.success) {
          updatePageArNS(pageId, {
            name: page.arns.name,
            undername: page.arns.undername,
            targetTxId: ver.txId,
            arnsTxId: res.transactionId,
          });
          addPageVersion(pageId, { ...ver, arnsRepointTxId: res.transactionId }, page.def);
          setStage('complete');
          setPublishing(false);
          return { success: true };
        }
        const message = res.error || 'Failed to update ArNS record.';
        setError(message);
        setStage('error');
        setPublishing(false);
        return { success: false, error: message };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update ArNS record.';
        setError(message);
        setStage('error');
        setPublishing(false);
        return { success: false, error: message };
      }
    },
    [getPage, updateArNSRecord, updatePageArNS, addPageVersion, hasArNSAccess],
  );

  const reset = useCallback(() => {
    setStage('idle');
    setError(null);
    setPublishing(false);
  }, []);

  return { publish, repointArNS, reset, publishing, stage, error };
}
