import type { FunnelStageKey } from "../../shared/analytics"

/**
 * Funnel benchmarks, in percent. Edit freely: this is the only place the
 * leak detector reads them from.
 *
 * Each step is "from -> to", where "from" is the nearest stage above that
 * Instagram reported. That is why steps that skip a stage are listed too:
 * when profile visits are unavailable, the funnel compares Views to Follows
 * directly.
 *
 * The defaults are starting points for organic Instagram accounts that sell
 * a service. They are not Meta figures. Tune them to your clients.
 */
export interface Benchmark {
  /** Below this, the step is flagged as a leak. */
  low: number
  /** At or above this, the step is healthy. */
  high: number
  /** One plain English line shown when this step is the biggest leak. */
  hint: string
}

export type FunnelStepKey = `${FunnelStageKey}->${FunnelStageKey}`

export const FUNNEL_BENCHMARKS: Partial<Record<FunnelStepKey, Benchmark>> = {
  "views->profile_visits": {
    low: 1,
    high: 3,
    hint: "Your reels get watched but don't make people curious about you. Test stronger CTAs to your profile.",
  },
  "profile_visits->follows": {
    low: 8,
    high: 20,
    hint: "People check your profile but don't follow. Tighten your bio and pin posts that show what you do.",
  },
  "follows->new_dms": {
    low: 5,
    high: 15,
    hint: "New followers aren't starting conversations. Give them a reason to DM you, like a keyword for a free resource.",
  },
  "views->follows": {
    low: 0.1,
    high: 0.5,
    hint: "Your reels get watched but viewers don't follow. End each reel with a clear reason to follow for more.",
  },
  "profile_visits->new_dms": {
    low: 0.5,
    high: 2,
    hint: "Profile visitors aren't messaging you. Add a clear DM call to action to your bio.",
  },
  "views->new_dms": {
    low: 0.01,
    high: 0.05,
    hint: "Views aren't turning into conversations. Add a comment keyword or DM prompt to your reels.",
  },
}
