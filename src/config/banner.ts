// Banner configuration
// To show a banner, set enabled: true and update the id, message, and optional link
// Each banner should have a unique id so dismissals are tracked separately

export interface BannerConfig {
  enabled: boolean;
  id: string;  // Unique identifier for localStorage tracking
  message: string;
  link?: {
    text: string;
    href: string;
    external?: boolean;
  };
  variant: 'subtle' | 'prominent';  // subtle = lavender, prominent = purple
}

export const BANNER_CONFIG: BannerConfig = {
  enabled: true,
  id: 'solana-migration-apr-2026',
  message: 'Ar.io is migrating to Solana! Register before the May 15, 2026 snapshot!',
  link: {
    text: 'Learn More',
    href: 'https://ar.io/solana-migration/',
    external: true,
  },
  variant: 'prominent',
};

// LocalStorage key for tracking dismissed banners
export const DISMISSED_BANNERS_KEY = 'ario-dismissed-banners';
