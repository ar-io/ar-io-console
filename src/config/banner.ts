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
  };
  variant: 'subtle' | 'prominent'; // subtle = lavender, prominent = purple
}

export const BANNER_CONFIG: BannerConfig = {
  enabled: true,
  id: 'pages-launch-2026',
  message: 'New — build a permanent link-in-bio page, live in seconds.',
  link: {
    text: 'Try Pages',
    href: '/pages?new',
    external: false,
  },
  variant: 'subtle',
};

// LocalStorage key for tracking dismissed banners
export const DISMISSED_BANNERS_KEY = 'ario-dismissed-banners';
