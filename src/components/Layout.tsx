import { Component, Suspense, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import Banner from './Banner';

// Shown in the content area while a lazily-loaded route chunk downloads. The
// surrounding chrome (header/nav/footer) stays mounted because this Suspense
// boundary sits inside Layout, around the Outlet.
function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

// Recovers a failed route instead of blanking the app: a rejected lazy-chunk
// import (network blip, or a stale chunk after a redeploy) or a render throw
// would otherwise escape <Suspense> (which only handles the loading state).
// Keyed by pathname in Layout, so navigating to another route clears the error.
class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Route failed to render/load:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
          <p className="text-foreground/80">This page failed to load.</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Layout() {
  const { pathname } = useLocation();
  return (
    /*
     * Page ground is plain white — deliberately, not by omission.
     *
     * The brand kit has no full-page gradient. Its model is a white ground with
     * colour carried by SECTION BANDS (`section_backgrounds` + `section_rhythm`:
     * deep dark, charcoal, white, lavender wash, warm neutral, alternating and
     * never repeating adjacently). The old white→lavender viewport-fixed fade
     * predates that and actively fought it: because it was anchored to the
     * viewport rather than the document, every band and card had a backdrop that
     * changed as you scrolled, so nothing could hold a stable edge — the ArNS
     * band needed a border to survive it, and the lavender footer had no visible
     * boundary at all.
     *
     * If a page wants colour, give it a `.full-bleed` band, not a page tint.
     *
     * overflow-x-clip absorbs the scrollbar-width overhang from `.full-bleed`
     * bands. `clip` NOT `hidden`: hidden would turn this into a scroll container
     * and break the sticky header below.
     */
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-clip">
      {/* Announcement Banner */}
      <Banner />

      {/* Fixed Header */}
      {/* Header sits on white, so the brand's Subtle Border (#E6E4EF) is the
          correct divider here. Inside #F0F0F0 cards it would be near-invisible —
          those keep border-border/20. */}
      <div className="sticky top-0 z-50 bg-background border-b border-subtle-border">
        <div className="max-w-site mx-auto px-1 sm:px-6 lg:px-8 w-full">
          <Header />
        </div>
      </div>

      {/* Main Content with proper spacing */}
      <div className="flex-1">
        <div className="max-w-site mx-auto px-1 sm:px-6 lg:px-8 w-full">
          <div className="pt-6 sm:pt-8 pb-3 sm:pb-4 mb-6 sm:mb-8">
            <RouteErrorBoundary key={pathname}>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}