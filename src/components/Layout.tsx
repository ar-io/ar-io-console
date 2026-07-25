import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
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

export function Layout() {
  return (
    <div
      className="min-h-screen text-foreground flex flex-col"
      style={{
        // Page background: white fading to lavender (matches ar.io public site).
        // Anchored to the viewport (fixed) so growing/expanding content doesn't
        // restretch the gradient — the white band and lavender stay put.
        background: 'linear-gradient(to bottom, rgb(255 255 255) 0%, rgb(255 255 255) 33%, rgb(223 214 247) 66%, rgb(223 214 247) 100%)',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Announcement Banner */}
      <Banner />

      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border/20">
        <div className="max-w-7xl mx-auto px-1 sm:px-6 lg:px-8 w-full">
          <Header />
        </div>
      </div>

      {/* Main Content with proper spacing */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-1 sm:px-6 lg:px-8 w-full">
          <div className="pt-6 sm:pt-8 pb-3 sm:pb-4 mb-6 sm:mb-8">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}