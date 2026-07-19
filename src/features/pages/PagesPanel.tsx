import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { useStore, type ConsolePage } from '@/store/useStore';
import type { SupportedTokenType } from '@/constants';
import { getArweaveUrl } from '@/utils';
import { useFreeUploadLimit } from '@/hooks/useFreeUploadLimit';
import { useWincForOneGiB, usePerDataItemFee } from '@/hooks/useWincForOneGiB';
import { DEFAULT_TEMPLATE, emptyPageDef, migratePageDef, type PageDef, type TemplateId } from './schema';
import { renderCtxFor } from './publish/renderCtx';
import { computeDefHash } from './publish/pageFile';
import { prepareDefForPublish } from './publish/permalink';
import type { RenderCtx } from './render/renderPageHtml';
import type { Tag } from './publish/tags';
import { usePagePublish, type PublishResult } from './hooks/usePagePublish';
import { blankPageDef, seedFromTemplate, withBlockIds } from './components/pageDefFactory';
import TemplateGallery from './components/TemplateGallery';
import PageEditor from './components/PageEditor';
import PublishModal from './components/PublishModal';
import PublishSuccess from './components/PublishSuccess';
import PagesDashboard from './components/PagesDashboard';
import VersionHistory from './components/VersionHistory';

type View = 'dashboard' | 'gallery' | 'editor' | 'success' | 'versions';

/** Where the editor was entered from — controls where "back" returns to. */
type EditorOrigin = 'gallery' | 'dashboard';

// A stable throwaway def so `renderCtxFor` (which only reads config/opts) has a
// value to receive in states where there is no working page yet.
const DUMMY_DEF = emptyPageDef(DEFAULT_TEMPLATE);

export default function PagesPanel() {
  const upsertPageDraft = useStore((s) => s.upsertPageDraft);
  const setPageLabels = useStore((s) => s.setPageLabels);
  const duplicatePage = useStore((s) => s.duplicatePage);
  const getPage = useStore((s) => s.getPage);
  const pages = useStore((s) => s.pages);
  const address = useStore((s) => s.address);
  const walletType = useStore((s) => s.walletType);
  const creditBalance = useStore((s) => s.creditBalance);
  const jitPaymentEnabled = useStore((s) => s.jitPaymentEnabled);
  const arioGatewayUrl = useStore((s) => s.getCurrentConfig().arioGatewayUrl);
  const configMode = useStore((s) => s.configMode);

  const { freeUploadLimitBytes } = useFreeUploadLimit();
  const wincForOneGiB = useWincForOneGiB();
  const perDataItemFeeWinc = usePerDataItemFee();
  const { publish, repointArNS, reset: resetPublish, publishing, stage, error } = usePagePublish();

  const [view, setView] = useState<View>('dashboard');
  const [editorOrigin, setEditorOrigin] = useState<EditorOrigin>('gallery');
  const [def, setDef] = useState<PageDef | null>(null);
  const [saved, setSaved] = useState(true);

  // Version-history target (derived from the store so rollbacks re-render live).
  const [versionPageId, setVersionPageId] = useState<string | null>(null);
  const versionPage = useMemo(
    () => (versionPageId ? pages.find((p) => p.id === versionPageId) : undefined),
    [pages, versionPageId],
  );

  // Domain (ArNS) selection
  const [arnsEnabled, setArnsEnabled] = useState(false);
  const [arnsName, setArnsName] = useState('');
  const [arnsUndername, setArnsUndername] = useState('');
  const [arnsShowUndername, setArnsShowUndername] = useState(false);

  // Publish-time metadata
  const [customTags, setCustomTags] = useState<Tag[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Publish flow
  const [showPublish, setShowPublish] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  const update = useCallback((updater: (d: PageDef) => PageDef) => {
    setDef((prev) => (prev ? { ...updater(prev), updatedAt: Date.now() } : prev));
  }, []);

  // Keep the working def's ArNS name in sync with the Domain selection. Uses a
  // functional update + equality guard so it never loops.
  useEffect(() => {
    const target =
      arnsEnabled && arnsName
        ? arnsUndername
          ? `${arnsUndername}_${arnsName}`
          : arnsName
        : undefined;
    setDef((prev) => {
      if (!prev) return prev;
      if ((prev.arnsName || undefined) === (target || undefined)) return prev;
      return { ...prev, arnsName: target, updatedAt: Date.now() };
    });
  }, [arnsEnabled, arnsName, arnsUndername]);

  // Debounced autosave of the working draft (all local edits are free).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hash of the def as last persisted to the store — or, for a fresh seed that has
  // not been persisted yet, the seed's own hash. Comparing against it means:
  //   • a freshly-seeded page is NOT written until the user actually edits it (#3),
  //   • a no-op autosave (unchanged content) never re-writes/re-sorts the page (#4).
  const savedHashRef = useRef<string | null>(null);
  // Latest committed def, so flush handlers (unmount/navigate/beforeunload) can
  // persist the final typing burst without depending on a stale closure (#2).
  const defRef = useRef<PageDef | null>(null);
  useEffect(() => {
    defRef.current = def;
  });

  useEffect(() => {
    if (!def || view !== 'editor') return;
    const hash = computeDefHash(def);
    // Nothing meaningful changed since the seed / last save — don't persist (#3/#4).
    if (hash === savedHashRef.current) {
      setSaved(true);
      return;
    }
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertPageDraft(def.id, def);
      savedHashRef.current = hash;
      setSaved(true);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [def, view, upsertPageDraft]);

  // Flush the pending draft immediately (cancels the debounce). Only writes when
  // there are genuinely unsaved changes, so it never re-sorts an unchanged page.
  const flushDraft = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const d = defRef.current;
    if (!d) return;
    const hash = computeDefHash(d);
    if (hash !== savedHashRef.current) {
      upsertPageDraft(d.id, d);
      savedHashRef.current = hash;
    }
    setSaved(true);
  }, [upsertPageDraft]);

  // Never lose the last typing burst: flush on tab close/refresh and on unmount
  // (navigating away from the Pages route). In-app view switches flush explicitly
  // in the navigate handlers below (#2).
  useEffect(() => {
    const onBeforeUnload = () => flushDraft();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      flushDraft();
    };
  }, [flushDraft]);

  const arnsTargetLabel = useMemo(() => {
    if (arnsEnabled && arnsName) return arnsUndername ? `${arnsUndername}_${arnsName}` : arnsName;
    return def?.arnsName || undefined;
  }, [arnsEnabled, arnsName, arnsUndername, def?.arnsName]);

  const previewCtx: RenderCtx = useMemo(
    () =>
      renderCtxFor(DUMMY_DEF, { arioGatewayUrl, configMode }, arnsTargetLabel ? { arnsName: arnsTargetLabel } : {}),
    [arioGatewayUrl, configMode, arnsTargetLabel],
  );

  // The def as it will actually be published: neutralise a seed's placeholder
  // `ar://<txid>` verify link (→ `#`, omitted) or point it at the assigned domain,
  // so the live preview matches the published output rather than resolving to a
  // fake-tx 404 (#6). Mirrors usePagePublish's `prepareDefForPublish` call.
  const previewDef = useMemo(
    () => (def ? prepareDefForPublish(def, arnsTargetLabel) : null),
    [def, arnsTargetLabel],
  );

  // Reset all working/metadata state (shared by the fresh-create + view-all flows).
  const resetWorkingState = useCallback(() => {
    setDef(null);
    defRef.current = null;
    savedHashRef.current = null;
    setPublishResult(null);
    setArnsEnabled(false);
    setArnsName('');
    setArnsUndername('');
    setArnsShowUndername(false);
    setCustomTags([]);
    setLabels([]);
    setNote('');
    setSaved(true);
  }, []);

  // Fresh create — clean slate seeded from a template or blank. The draft is NOT
  // persisted here: browsing templates and backing out must not litter the
  // dashboard with unedited demo drafts. The autosave persists it on the first
  // real edit (the seed hash is the baseline, see savedHashRef) (#3).
  const startEditing = useCallback((nextDef: PageDef) => {
    const prepared = withBlockIds(nextDef);
    setDef(prepared);
    defRef.current = prepared;
    savedHashRef.current = computeDefHash(prepared);
    setArnsEnabled(false);
    setArnsName('');
    setArnsUndername('');
    setArnsShowUndername(false);
    setCustomTags([]);
    setLabels([]);
    setNote('');
    setPublishResult(null);
    setSaved(true);
    setEditorOrigin('gallery');
    setView('editor');
  }, []);

  // Edit an existing page — hydrate the editor from its stored def + domain.
  // Migrate/validate defensively so a corrupt or older stored def can never throw
  // the editor (#7); the baseline hash is the stored def, so merely opening a page
  // never re-writes it (only real edits do).
  const editExisting = useCallback((page: ConsolePage) => {
    let hydrated: PageDef;
    try {
      hydrated = withBlockIds(migratePageDef(page.def));
    } catch {
      hydrated = withBlockIds(page.def);
    }
    setDef(hydrated);
    defRef.current = hydrated;
    savedHashRef.current = computeDefHash(hydrated);
    if (page.arns) {
      setArnsEnabled(true);
      setArnsName(page.arns.name);
      setArnsUndername(page.arns.undername || '');
      setArnsShowUndername(Boolean(page.arns.undername));
    } else {
      setArnsEnabled(false);
      setArnsName('');
      setArnsUndername('');
      setArnsShowUndername(false);
    }
    setCustomTags([]);
    setLabels(page.labels ?? []);
    setNote('');
    setPublishResult(null);
    setSaved(true);
    setEditorOrigin('dashboard');
    setView('editor');
  }, []);

  const handleSelectTemplate = useCallback(
    (id: TemplateId) => startEditing(seedFromTemplate(id)),
    [startEditing],
  );
  const handleStartBlank = useCallback(() => startEditing(blankPageDef()), [startEditing]);

  // Duplicate a page and open the copy in the editor.
  const handleDuplicate = useCallback(
    (page: ConsolePage) => {
      const newId = duplicatePage(page.id);
      const copy = getPage(newId);
      if (copy) editExisting(copy);
    },
    [duplicatePage, getPage, editExisting],
  );

  const handleOpenVersionHistory = useCallback((page: ConsolePage) => {
    setVersionPageId(page.id);
    setView('versions');
  }, []);

  const handleMakeLive = useCallback(
    async (versionNumber: number) => {
      if (!versionPageId) return { success: false, error: 'No page selected.' };
      return repointArNS(versionPageId, versionNumber);
    },
    [versionPageId, repointArNS],
  );

  const goToGallery = useCallback(() => {
    flushDraft();
    resetWorkingState();
    setView('gallery');
  }, [flushDraft, resetWorkingState]);

  const goToDashboard = useCallback(() => {
    flushDraft();
    resetWorkingState();
    setVersionPageId(null);
    setView('dashboard');
  }, [flushDraft, resetWorkingState]);

  const handleLabelsChange = useCallback(
    (next: string[]) => {
      setLabels(next);
      if (def) setPageLabels(def.id, next);
    },
    [def, setPageLabels],
  );

  const openPublish = useCallback(() => {
    // Never reset publish state or re-open while an upload is in flight — that is
    // the re-entrancy path that could trigger a second upload/charge (#1).
    if (publishing) return;
    resetPublish();
    setPublishNotice(null);
    setShowPublish(true);
  }, [publishing, resetPublish]);

  const handleConfirmPublish = useCallback(
    async ({ jitEnabled, selectedJitToken }: { jitEnabled: boolean; selectedJitToken: SupportedTokenType }) => {
      if (!def || publishing) return;
      if (!address) {
        setPublishNotice('Connect a wallet to publish your page.');
        return;
      }
      setPublishNotice(null);
      const arns = arnsEnabled && arnsName ? { name: arnsName, undername: arnsUndername || undefined } : undefined;
      const cleanedTags = customTags.filter((t) => t.name.trim().length > 0);
      try {
        const result = await publish(def, {
          jitEnabled,
          selectedJitToken,
          customTags: cleanedTags,
          arns,
          note: note.trim() || undefined,
        });
        if (result.noChanges) {
          setPublishNotice('No changes since your last version — nothing to publish.');
          return;
        }
        if (result.ok) {
          setPublishResult(result);
          setShowPublish(false);
          setView('success');
        }
      } catch (e) {
        // usePagePublish already surfaces errors via `error`; this is a last resort.
        console.error('Publish failed:', e);
        setPublishNotice(e instanceof Error ? e.message : 'Publishing failed. Please try again.');
      }
    },
    [def, publishing, address, arnsEnabled, arnsName, arnsUndername, customTags, note, publish],
  );

  const successLiveUrl = useMemo(() => {
    if (!publishResult) return '';
    if (publishResult.arnsUpdated && arnsName) {
      const label = arnsUndername ? `${arnsUndername}_${arnsName}` : arnsName;
      return `https://${label}.${previewCtx.arnsHost || 'ar.io'}`;
    }
    return getArweaveUrl(publishResult.txId ?? '');
  }, [publishResult, arnsName, arnsUndername, previewCtx.arnsHost]);

  const successIsArns = Boolean(publishResult?.arnsUpdated && arnsName);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Service panel header */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card">
          <LayoutTemplate className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="mb-1 font-heading text-2xl font-extrabold text-foreground">Pages</h3>
          <p className="text-sm text-foreground/80">
            Build a permanent link-in-bio page — live at your name in seconds.
          </p>
        </div>
      </div>

      {view === 'dashboard' && (
        <PagesDashboard
          arioGatewayUrl={arioGatewayUrl}
          onCreate={goToGallery}
          onEdit={editExisting}
          onDuplicate={handleDuplicate}
          onVersionHistory={handleOpenVersionHistory}
        />
      )}

      {view === 'gallery' && (
        <div>
          <button
            type="button"
            onClick={goToDashboard}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All pages
          </button>
          <TemplateGallery
            arioGatewayUrl={arioGatewayUrl}
            onSelectTemplate={handleSelectTemplate}
            onStartBlank={handleStartBlank}
          />
        </div>
      )}

      {view === 'editor' && def && (
        <PageEditor
          def={def}
          previewDef={previewDef ?? def}
          update={update}
          ctx={previewCtx}
          saved={saved}
          publishing={publishing}
          backLabel={editorOrigin === 'dashboard' ? 'All pages' : 'Templates'}
          arnsEnabled={arnsEnabled}
          onArnsEnabledChange={setArnsEnabled}
          arnsName={arnsName}
          onArnsNameChange={setArnsName}
          arnsUndername={arnsUndername}
          onArnsUndernameChange={setArnsUndername}
          arnsShowUndername={arnsShowUndername}
          onArnsShowUndernameChange={setArnsShowUndername}
          customTags={customTags}
          onCustomTagsChange={setCustomTags}
          labels={labels}
          onLabelsChange={handleLabelsChange}
          note={note}
          onNoteChange={setNote}
          onBack={editorOrigin === 'dashboard' ? goToDashboard : goToGallery}
          onPublish={openPublish}
        />
      )}

      {view === 'success' && publishResult && (
        <PublishSuccess
          result={publishResult}
          liveUrl={successLiveUrl}
          isArns={successIsArns}
          onEdit={() => setView('editor')}
          onCreateAnother={goToGallery}
          onViewAllPages={goToDashboard}
        />
      )}

      {view === 'versions' && versionPage && (
        <VersionHistory page={versionPage} onBack={goToDashboard} onMakeLive={handleMakeLive} />
      )}

      {/* Version target vanished (e.g. deleted) — fall back to the dashboard. */}
      {view === 'versions' && !versionPage && (
        <PagesDashboard
          arioGatewayUrl={arioGatewayUrl}
          onCreate={goToGallery}
          onEdit={editExisting}
          onDuplicate={handleDuplicate}
          onVersionHistory={handleOpenVersionHistory}
        />
      )}

      {showPublish && def && (
        <PublishModal
          def={previewDef ?? def}
          ctx={previewCtx}
          arns={arnsEnabled && arnsName ? { name: arnsName, undername: arnsUndername || undefined } : undefined}
          note={note.trim()}
          publishing={publishing}
          stage={stage}
          error={error}
          notice={publishNotice}
          onClose={() => {
            // Guard the backdrop/Cancel close so the modal can't be dismissed
            // mid-upload (which would let the user re-trigger a second publish) (#1).
            if (!publishing) setShowPublish(false);
          }}
          onConfirm={handleConfirmPublish}
          freeUploadLimitBytes={freeUploadLimitBytes}
          wincForOneGiB={wincForOneGiB}
          perDataItemFeeWinc={perDataItemFeeWinc}
          creditBalance={creditBalance}
          walletType={walletType}
          jitPaymentEnabled={jitPaymentEnabled}
        />
      )}
    </div>
  );
}
