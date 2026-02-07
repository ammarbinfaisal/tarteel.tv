// src/lib/analytics.ts
import posthog from 'posthog-js'

type PostHogEvent = 'clip_play' | 'clip_share' | 'clip_download' | 'apply_filters';

interface EventParams {
  clip_id?: string;
  surah_num?: number | null;
  surah_name?: string | null;
  reciter_name?: string | null;
  reciter_slug?: string | null;
  riwayah?: string | null;
  translation?: string | null;
  [key: string]: any;
}

export const trackEvent = (event: PostHogEvent, params: EventParams) => {
  posthog.capture(event, params);
};
