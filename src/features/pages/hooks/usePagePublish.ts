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
import { useFreeUploadLimit, isFileFree } from '@/hooks/useFreeUploadLimit';
import type { SupportedTokenType } from '@/constants';
import { getTokenConverter, supportsJitPayment } from '@/utils/jitPayment';
import { validatePageDef, type PageDef } from '../schema';
import { renderPageHtml } from '../render/renderPageHtml';
import { buildOgCardSvg } from '../render/ogCard';
import { rasterizeSvgToPng } from '../publish/rasterizeOgCard';
import { buildPageTags, buildOgImageTags, type Tag } from '../publish/tags';
import {
  buildPagesManifest,
  buildManifestFile,
  buildManifestTags,
  ogImageUrlFor,
  OG_IMAGE_PATH,
} from '../publish/manifest';
import { buildPageFile, computeDefHash, slugify } from '../publish/pageFile';
import { renderCtxFor } from '../publish/renderCtx';
import { arnsLabel, prepareDefForPublish, type ArnsTarget } from '../publish/permalink';

export type PublishStage =
  | 'idle'
  | 'rendering'
  | 'uploading'
  | 'finalizing'
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
  const jitMaxTokenAmount = useStore((s) => s.jitMaxTokenAmount);
  const jitBufferMultiplier = useStore((s) => s.jitBufferMultiplier);
  const x402OnlyMode = useStore((s) => s.x402OnlyMode);
  const { freeUploadLimitBytes } = useFreeUploadLimit();
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
          const currentVer =
            existing?.versions.find((v) => v.version === existing.currentVersion) ??
            existing?.versions[0];
          // Content is unchanged. If the user is (re)assigning a domain, skip the
          // redundant re-upload but still apply the ArNS change against the current
          // version's tx — otherwise toggling a domain here would silently no-op.
          if (options.arns && existing && currentVer) {
            if (!hasArNSAccess) {
              setStage('idle');
              setPublishing(false);
              return {
                ok: false,
                noChanges: true,
                pageId,
                arnsError: 'Link a Solana wallet to assign a domain.',
              };
            }
            setStage('updating-arns');
            try {
              const res = await updateArNSRecord(
                options.arns.name,
                currentVer.txId,
                options.arns.undername,
              );
              if (res.success) {
                updatePageArNS(pageId, {
                  name: options.arns.name,
                  undername: options.arns.undername,
                  targetTxId: currentVer.txId,
                  arnsTxId: res.transactionId,
                });
                addPageVersion(
                  pageId,
                  { ...currentVer, arnsRepointTxId: res.transactionId },
                  existing.def,
                );
                setStage('complete');
                setPublishing(false);
                return {
                  ok: true,
                  pageId,
                  version: currentVer.version,
                  txId: currentVer.txId,
                  arnsUpdated: true,
                };
              }
              setStage('idle');
              setPublishing(false);
              return {
                ok: false,
                noChanges: true,
                pageId,
                arnsError: res.error || 'Failed to update ArNS record.',
              };
            } catch (e) {
              setStage('idle');
              setPublishing(false);
              return {
                ok: false,
                noChanges: true,
                pageId,
                arnsError: e instanceof Error ? e.message : 'Failed to update ArNS record.',
              };
            }
          }
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

        let publishDef = prepareDefForPublish(validated, permalinkLabel);

        // Auto-generate a social-preview (OG) card so a shared page link renders a
        // real preview image. Strictly best-effort and zero-cost: we only upload it
        // when it fits the free tier (and never in x402-only mode, where every item
        // is a separate paid upload). Runs first so its tx can go in the manifest
        // and its URL can be baked into the page <head>. Note we build a fresh copy
        // of publishDef — prepareDefForPublish may return the stored def by reference.
        let socialTxId: string | undefined;
        if (!x402OnlyMode && freeUploadLimitBytes > 0) {
          try {
            const ogPng = await rasterizeSvgToPng(buildOgCardSvg(publishDef));
            if (ogPng && isFileFree(ogPng.size, freeUploadLimitBytes)) {
              const ogFile = new File([ogPng], OG_IMAGE_PATH, { type: 'image/png' });
              const ogResult = await Promise.race([
                // .catch so a rejection AFTER the timeout wins isn't left unhandled.
                uploadFile(ogFile, { customTags: buildOgImageTags(validated, nextVersion) }).catch(() => null),
                new Promise<null>((r) => setTimeout(() => r(null), 20000)),
              ]);
              if (ogResult?.id) socialTxId = ogResult.id;
            }
          } catch {
            // Publish without an OG preview image.
          }
        }

        // Bake the preview URL into the page. A named page uses its own manifest
        // path (`<name>.<host>/social.png`) — future-proof for gateways that may
        // serve only ArNS names + manifest paths, not raw tx ids; an unnamed page
        // falls back to the raw data-item URL. Set on the render copy only, never
        // on the stored/hashed source def, so dedup is unaffected.
        if (socialTxId) {
          const ogImage = ogImageUrlFor({
            socialTxId,
            arnsLabel: permalinkLabel,
            arnsHost: ctx.arnsHost,
            gateway: ctx.gateway,
          });
          publishDef = { ...publishDef, meta: { ...(publishDef.meta ?? {}), ogImage } };
        } else if (publishDef.meta?.ogImage) {
          // No preview asset this publish (OG skipped/failed) → we deploy a bare index
          // tx with no manifest. Drop any ogImage inherited from an imported def, or it
          // would point at a /social.png path this deploy doesn't serve (a 404 preview).
          const meta = { ...publishDef.meta };
          delete meta.ogImage;
          publishDef = { ...publishDef, meta };
        }

        const html = renderPageHtml(publishDef, ctx);
        const indexFile = buildPageFile(html, slugify(validated.title));

        setStage('uploading');
        const tags = buildPageTags(validated, nextVersion, options.customTags ?? []);
        // JIT auto-pay cap: convert the user's configured per-token max to smallest
        // units for the selected token. Without this the upload hook falls back to
        // maxTokenAmount:0, which the SDK treats as a HARD zero cap (so every JIT
        // top-up fails), not "unlimited".
        const jitToken = options.selectedJitToken;
        const jitMaxSmallest =
          options.jitEnabled && jitToken && supportsJitPayment(jitToken)
            ? getTokenConverter(jitToken)?.(jitMaxTokenAmount[jitToken] ?? 0) ?? undefined
            : undefined;

        const indexResult = await uploadFile(indexFile, {
          customTags: tags,
          jitEnabled: options.jitEnabled,
          selectedJitToken: options.selectedJitToken,
          jitMaxTokenAmount: jitMaxSmallest,
          jitBufferMultiplier,
          // Once bytes are fully sent the bundler still needs to finalize — surface
          // that so the modal doesn't sit on "Uploading…" looking stuck.
          onProgress: (pct) => {
            if (pct >= 100) setStage('finalizing');
          },
        });

        // Deploy as an arweave/paths manifest when there's a preview asset, so the
        // page and its social image share one tx and resolve by clean paths
        // (`<name>.ar.io/` and `<name>.ar.io/social.png`). The manifest is tiny and
        // free. It is NOT wrapped in a fallback: for a named page the baked
        // og:image points at the manifest path, so a failed manifest would 404 the
        // preview — better to fail the publish (old version stays live) and retry.
        // With no preview asset we deploy the bare page tx (single file, no manifest).
        let deployTxId = indexResult.id;
        if (socialTxId) {
          const manifestFile = buildManifestFile(
            buildPagesManifest({ indexTxId: indexResult.id, socialTxId }),
          );
          const manifestResult = await uploadFile(manifestFile, {
            customTags: buildManifestTags(validated, nextVersion),
          });
          deployTxId = manifestResult.id;
        }

        const version: PageVersion = {
          version: nextVersion,
          txId: deployTxId,
          size: indexFile.size,
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
                deployTxId,
                options.arns.undername,
              );
              if (res.success) {
                arnsUpdated = true;
                updatePageArNS(pageId, {
                  name: options.arns.name,
                  undername: options.arns.undername,
                  targetTxId: deployTxId,
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
          txId: deployTxId,
          size: indexFile.size,
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
    [getCurrentConfig, configMode, getPage, addPageVersion, updatePageArNS, uploadFile, updateArNSRecord, hasArNSAccess, jitMaxTokenAmount, jitBufferMultiplier, x402OnlyMode, freeUploadLimitBytes],
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

      // Single-flight guard (mirrors publish): a double-click must not fire two
      // concurrent ArNS updates. Shares inFlightRef with publish, so the two can't
      // run at once either.
      if (inFlightRef.current) {
        return { success: false, error: 'An update is already in progress.' };
      }
      inFlightRef.current = true;
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
      } finally {
        inFlightRef.current = false;
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
