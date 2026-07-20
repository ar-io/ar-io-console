import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Globe,
  Layers,
  Palette,
  Rocket,
  Settings,
  User,
  Wallet,
} from 'lucide-react';
import { promptSignIn } from '@/utils';
import type { PageDef } from '../schema';
import type { RenderCtx } from '../render/renderPageHtml';
import type { Tag } from '../publish/tags';
import LivePreview from './LivePreview';
import SizeMeter from './SizeMeter';
import { Section } from './controls/primitives';
import ProfileControls from './controls/ProfileControls';
import BlocksControls from './controls/BlocksControls';
import ThemeControls from './controls/ThemeControls';
import DomainControls from './controls/DomainControls';
import PageSettingsControls from './controls/PageSettingsControls';

export interface PageEditorProps {
  def: PageDef;
  /** Publish-prepared def for the live preview (verify link neutralised/resolved). */
  previewDef?: PageDef;
  update: (updater: (d: PageDef) => PageDef) => void;
  ctx: RenderCtx;
  saved: boolean;
  /** True while a publish is in flight — disables Publish to prevent a double upload. */
  publishing?: boolean;
  /** Whether a wallet is connected. Logged out, Publish becomes a "Sign in" CTA. */
  signedIn: boolean;
  /** Label for the back button (e.g. "Templates" for create, "All pages" for edit). */
  backLabel?: string;
  // Domain (ArNS) state
  arnsEnabled: boolean;
  onArnsEnabledChange: (v: boolean) => void;
  arnsName: string;
  onArnsNameChange: (v: string) => void;
  arnsUndername: string;
  onArnsUndernameChange: (v: string) => void;
  arnsShowUndername: boolean;
  onArnsShowUndernameChange: (v: boolean) => void;
  // Settings state
  customTags: Tag[];
  onCustomTagsChange: (tags: Tag[]) => void;
  labels: string[];
  onLabelsChange: (labels: string[]) => void;
  note: string;
  onNoteChange: (note: string) => void;
  // Pricing (for the live size meter)
  freeUploadLimitBytes: number;
  wincForOneGiB?: string;
  perDataItemFeeWinc?: string;
  // Actions
  onBack: () => void;
  onPublish: () => void;
}

export default function PageEditor(props: PageEditorProps) {
  const { def, previewDef, update, ctx, saved, publishing = false, backLabel = 'Templates', signedIn, onBack, onPublish } = props;
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [sizeBytes, setSizeBytes] = useState(0);
  const preview = previewDef ?? def;

  const sizeMeter = (
    <SizeMeter
      sizeBytes={sizeBytes}
      freeUploadLimitBytes={props.freeUploadLimitBytes}
      wincForOneGiB={props.wincForOneGiB}
      perDataItemFeeWinc={props.perDataItemFeeWinc}
    />
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {backLabel}
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1 text-xs text-foreground/50 sm:inline-flex">
            <Check className="h-3.5 w-3.5 text-success" />
            {saved ? 'All changes saved' : 'Saving…'}
          </span>
          <button
            type="button"
            onClick={signedIn ? onPublish : promptSignIn}
            disabled={publishing}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signedIn ? (
              <>
                <Rocket className="h-4 w-4" /> Publish
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" /> Sign in to publish
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile preview (collapsible, mounts only when opened) */}
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePreviewOpen((v) => !v)}
          aria-expanded={mobilePreviewOpen}
          className="flex w-full items-center justify-between rounded-2xl border border-border/20 bg-card px-4 py-3 text-sm font-medium text-foreground"
        >
          <span>{mobilePreviewOpen ? 'Hide preview' : 'Show live preview'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${mobilePreviewOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobilePreviewOpen && <LivePreview def={preview} ctx={ctx} className="mt-4" />}
        <div className="mt-3">{sizeMeter}</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left: controls */}
        <div className="space-y-3">
          <Section icon={<User className="h-4 w-4" />} title="Profile" subtitle="Avatar, name, bio" defaultOpen>
            <ProfileControls def={def} update={update} ctx={ctx} />
          </Section>

          <Section
            icon={<Layers className="h-4 w-4" />}
            title="Blocks"
            subtitle={`${def.blocks.length} block${def.blocks.length === 1 ? '' : 's'} · links, socials, more`}
            defaultOpen
          >
            <BlocksControls def={def} update={update} ctx={ctx} />
          </Section>

          <Section icon={<Palette className="h-4 w-4" />} title="Theme & layout" subtitle="Colors, fonts, layout">
            <ThemeControls def={def} update={update} ctx={ctx} />
          </Section>

          <Section icon={<Globe className="h-4 w-4" />} title="Domain (ArNS)" subtitle="Point a smart domain at your page">
            <DomainControls
              enabled={props.arnsEnabled}
              onEnabledChange={props.onArnsEnabledChange}
              selectedName={props.arnsName}
              onNameChange={props.onArnsNameChange}
              selectedUndername={props.arnsUndername}
              onUndernameChange={props.onArnsUndernameChange}
              showUndername={props.arnsShowUndername}
              onShowUndernameChange={props.onArnsShowUndernameChange}
            />
          </Section>

          <Section icon={<Settings className="h-4 w-4" />} title="Page settings" subtitle="SEO, tags, labels, version note">
            <PageSettingsControls
              def={def}
              update={update}
              ctx={ctx}
              customTags={props.customTags}
              onCustomTagsChange={props.onCustomTagsChange}
              labels={props.labels}
              onLabelsChange={props.onLabelsChange}
              note={props.note}
              onNoteChange={props.onNoteChange}
            />
          </Section>
        </div>

        {/* Right: sticky preview (desktop). This instance stays mounted across
            breakpoints, so its onSize keeps the meter current even on mobile. */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-3">
            <LivePreview def={preview} ctx={ctx} onSize={setSizeBytes} />
            {sizeMeter}
          </div>
        </div>
      </div>
    </div>
  );
}
