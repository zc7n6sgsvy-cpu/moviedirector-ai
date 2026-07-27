/**
 * MovieDirector Feed — Repertory Rotation (anti-decay, revolving catalog)
 *
 * Social apps: post → spike → time decay → die.
 * Us: film enters a living theater slate. Age does not bury you.
 *     Attention keeps you spinning. A year-old show that still gets
 *     watched can return to the marquee ("still playing").
 *
 * @see PRODUCT_VIBE.md
 *
 * Forces:
 *  1) CRAFT — Bayesian ratings; good work stays worthy forever
 *  2) STILL PLAYING — recent watches/rewatches (velocity), age-independent
 *  3) SECOND SCREENING — under-seen fairness so the catalog resurfaces work
 *  4) PREMIERE — opening-week spotlight boost only (never a later penalty)
 *  5) DAILY SALT — soft reshuffle among peers so the shelf feels alive
 *
 * Lanes: premiere | still-playing | second-screening | repertory
 */

export type FeedLane = 'premiere' | 'repertory' | 'second-screening' | 'still-playing';

export type FeedRankInput = {
  id: string;
  publishedAt: Date | string;
  likeCount?: number;
  commentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  /** Total opens — lifetime catalog exposure */
  impressionCount?: number;
  /** Total watches/rewatches (each open counts) */
  watchCount?: number;
  /** Last time someone opened/watched — powers revolving slate */
  lastWatchedAt?: Date | string | null;
};

export type FeedRankedItem<T extends FeedRankInput> = T & {
  feedScore: number;
  feedLane: FeedLane;
  feedReasons: string[];
};

/** Opening-week spotlight only (boost, not later penalty). */
export const PREMIERE_DAYS = 7;

/** Recent watch window for "still playing" marquee return */
export const STILL_PLAYING_DAYS = 21;

const BAYES_PRIOR_MEAN = 3.6;
const BAYES_PRIOR_STRENGTH = 4;

export function repertoryDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dailyRotationSalt(id: string, dayKey: string): number {
  let h = 2166136261;
  const s = `${dayKey}:${id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function craftScore(ratingAvg: number, ratingCount: number): number {
  const n = Math.max(0, ratingCount || 0);
  const avg = ratingAvg > 0 ? ratingAvg : BAYES_PRIOR_MEAN;
  const bayes =
    (BAYES_PRIOR_STRENGTH * BAYES_PRIOR_MEAN + n * avg) / (BAYES_PRIOR_STRENGTH + n);
  return Math.min(1, Math.max(0, (bayes - 1) / 4));
}

/**
 * Under-seen fairness: low lifetime exposure → chance to surface.
 * Does not punish old films — only over-exposure.
 */
export function fairnessScore(input: FeedRankInput): number {
  const impressions = Math.max(0, input.impressionCount ?? 0);
  const watches = Math.max(0, input.watchCount ?? 0);
  const engagement =
    Math.max(0, input.likeCount || 0) +
    Math.max(0, input.commentCount || 0) * 2 +
    Math.max(0, input.ratingCount || 0) * 3;

  const exposure =
    impressions > 0 || watches > 0
      ? impressions + watches * 2
      : engagement * 4;
  return 1 / (1 + Math.log1p(exposure));
}

export function audienceScore(input: FeedRankInput): number {
  const likes = Math.max(0, input.likeCount || 0);
  const comments = Math.max(0, input.commentCount || 0);
  const raw = Math.log1p(likes) + 1.4 * Math.log1p(comments);
  return Math.min(1, raw / 8);
}

/**
 * STILL PLAYING — the revolving-asset heart.
 * If something is a year old but watched this week, it can pop on the feed.
 * Age of the film is irrelevant; recency of attention is everything.
 */
export function stillPlayingScore(
  input: FeedRankInput,
  now = new Date()
): number {
  const watches = Math.max(0, input.watchCount ?? input.impressionCount ?? 0);
  const lastRaw = input.lastWatchedAt;
  if (!lastRaw && watches === 0) return 0;

  let daysSinceWatch = 999;
  if (lastRaw) {
    const t = lastRaw instanceof Date ? lastRaw : new Date(lastRaw);
    if (!Number.isNaN(t.getTime())) {
      daysSinceWatch = Math.max(0, (now.getTime() - t.getTime()) / 86400000);
    }
  } else if (watches > 0) {
    // Have lifetime watches but no lastWatchedAt yet — mild residual from volume only
    daysSinceWatch = 45;
  }

  // Strong within STILL_PLAYING_DAYS; soft tail after so recent classics linger
  let recency = 0;
  if (daysSinceWatch <= STILL_PLAYING_DAYS) {
    recency = 1 - daysSinceWatch / STILL_PLAYING_DAYS;
  } else if (daysSinceWatch < 90) {
    recency = 0.15 * (1 - (daysSinceWatch - STILL_PLAYING_DAYS) / (90 - STILL_PLAYING_DAYS));
  }

  // Rewatch volume: log so a cult classic with many watches keeps circulating
  const volume = Math.min(1, Math.log1p(watches) / 5);

  // Films older than premiere that still get watches get a tiny "cult" nod
  // (does not punish new films)
  let cult = 0;
  const pub = input.publishedAt instanceof Date ? input.publishedAt : new Date(input.publishedAt);
  if (!Number.isNaN(pub.getTime()) && recency > 0.2) {
    const ageDays = (now.getTime() - pub.getTime()) / 86400000;
    if (ageDays > 30) cult = Math.min(0.15, Math.log1p(ageDays / 30) / 10);
  }

  return Math.min(1, 0.55 * recency + 0.35 * volume + cult);
}

/** Opening-week boost only. After window: 0 — not a penalty. */
export function premiereBoost(publishedAt: Date | string, now = new Date()): number {
  const t = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(t.getTime())) return 0;
  const ageDays = (now.getTime() - t.getTime()) / 86400000;
  if (ageDays < 0) return 0.06;
  if (ageDays > PREMIERE_DAYS) return 0;
  return 0.08 * (1 - ageDays / PREMIERE_DAYS);
}

export function scoreFeedItem(
  input: FeedRankInput,
  now = new Date(),
  dayKey = repertoryDayKey(now)
): { score: number; lane: FeedLane; reasons: string[] } {
  const craft = craftScore(input.ratingAvg || 0, input.ratingCount || 0);
  const audience = audienceScore(input);
  const fairness = fairnessScore(input);
  const stillPlaying = stillPlayingScore(input, now);
  const premiere = premiereBoost(input.publishedAt, now);
  const salt = dailyRotationSalt(input.id, dayKey);

  // Still-playing is the anti-decay engine: attention keeps assets revolving
  const score =
    0.38 * craft +
    0.28 * stillPlaying +
    0.14 * audience +
    0.12 * fairness +
    premiere +
    0.05 * salt;

  const reasons: string[] = [];
  if (stillPlaying >= 0.45) {
    reasons.push('Still playing — recent watches keep it in rotation');
  }
  if (premiere > 0.03) reasons.push('Opening week on the marquee');
  if (craft >= 0.55 && (input.ratingCount || 0) >= 3) reasons.push('Strong craft / ratings');
  if (fairness >= 0.55 && stillPlaying < 0.4) {
    reasons.push('Second screening — under-seen in the catalog');
  }
  if (audience >= 0.4) reasons.push('Audience heat (likes & discussion)');
  if (!reasons.length) reasons.push('In repertory rotation');

  let lane: FeedLane = 'repertory';
  if (stillPlaying >= 0.5) lane = 'still-playing';
  else if (premiere > 0.04 && craft < 0.65 && stillPlaying < 0.45) lane = 'premiere';
  else if (fairness >= 0.6 && craft < 0.7 && stillPlaying < 0.35) lane = 'second-screening';
  else if (
    fairness >= 0.55 &&
    (input.impressionCount || 0) < 20 &&
    craft < 0.65 &&
    stillPlaying < 0.35
  ) {
    lane = 'second-screening';
  }

  return { score, lane, reasons };
}

export function rankFeedItems<T extends FeedRankInput>(
  items: T[],
  now = new Date()
): FeedRankedItem<T>[] {
  const dayKey = repertoryDayKey(now);
  const ranked = items.map((item) => {
    const { score, lane, reasons } = scoreFeedItem(item, now, dayKey);
    return {
      ...item,
      feedScore: score,
      feedLane: lane,
      feedReasons: reasons,
    };
  });

  ranked.sort((a, b) => {
    if (b.feedScore !== a.feedScore) return b.feedScore - a.feedScore;
    const ta = new Date(a.publishedAt).getTime();
    const tb = new Date(b.publishedAt).getTime();
    return tb - ta;
  });

  return ranked;
}

export const FEED_ALGORITHM_META = {
  id: 'repertoire-v2-still-playing',
  name: 'Repertory Rotation',
  tagline:
    'Revolving cinema catalog — watches keep films spinning. Age does not bury you.',
  principles: [
    'No time decay that zeros out older posts',
    'Still playing: recent watches/rewatches pull year-old work back onto the marquee',
    'Craft keeps great work worthy forever',
    'Under-seen fairness resurfaces catalog gems',
    'Opening week is a spotlight boost only',
    'Daily salt reshuffles peers so the shelf feels alive',
  ],
} as const;
