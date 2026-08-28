// Banner configuration
// To show a banner, set enabled: true and update the id, message, and optional link
// Each banner should have a unique id so dismissals are tracked separately

export interface BannerConfig {
  enabled: boolean;
  id: string; // Unique identifier for localStorage tracking
  message: string;
  link?: {
    text: string;
    href: string;
    external?: boolean;
    /** React Router navigation state for internal links (external links ignore it). */
    state?: Record<string, unknown>;
  };
  variant: 'subtle' | 'prominent'; // subtle = lavender, prominent = purple
}

export const BANNER_CONFIG: BannerConfig = {
  enabled: true,
  // New id: dismissals are tracked per id, so reusing the Pages one would hide
  // this from everyone who had already dismissed that.
  id: 'arns-launch-2026',
  message: 'Your credits buy domains now, not just storage.',
  link: {
    text: 'Register a name',
    href: '/arns',
    external: false,
  },
  variant: 'subtle',
};

// LocalStorage key for tracking dismissed banners
export const DISMISSED_BANNERS_KEY = 'ario-dismissed-banners';
