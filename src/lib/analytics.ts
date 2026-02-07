// src/lib/analytics.ts

type GTagEvent = 'clip_play' | 'clip_share' | 'clip_download' | 'apply_filters';

interface GTagParams {
  clip_id?: string;
  surah_num?: number | null;
  surah_name?: string | null;
  reciter_name?: string | null;
  reciter_slug?: string | null;
  riwayah?: string | null;
  translation?: string | null;
  [key: string]: any;
}

export const trackEvent = (event: GTagEvent, params: GTagParams) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event, params);
  }
};
