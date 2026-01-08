/**
 * Feature Flags Configuration
 *
 * Centralized place to enable/disable features across the app.
 * Set to `true` to enable, `false` to disable.
 *
 * Usage:
 *   import { featureFlags } from '@/lib/feature-flags';
 *   if (featureFlags.watchlist) { ... }
 *   {featureFlags.watchlist && <WatchlistComponent />}
 */

export const featureFlags = {
  /** Filter trades by user's Stockbit watchlist */
  watchlist: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;
