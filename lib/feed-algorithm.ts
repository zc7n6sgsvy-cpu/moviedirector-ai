/**
 * MovieDirector Feed — Repertory Rotation (anti-decay)
 *
 * Typical social feeds kill posts with time decay: post → spike → die.
 * Cinema does not work that way. Films enter a catalog and stay in rotation.
 *
 * Algorithm name: REPERTOIRE
 *
 * Three forces (no "hours since post → zero"):
 *  1) CRAFT — Bayesian star quality (ratings). Good work stays visible forever.
 *  2) FAIRNESS / SECOND SCREENING — under-seen films get a boost so the catalog
 *     resurfaces work that never got a fair look (anti rich-get-richer only).
 *  3) PREMIERE — short "opening week" spotlight for brand-new posts.
 *     This is a temporary BOOST, not a death sentence after week 1.
 *
 * Daily salt: same film can shift position day-to-day among peers so the shelf
 * feels alive — without burying older films permanently.
 *
 * Lanes (for UI badges, not hard filters):
 *  - premiere: opened within PREMIERE_DAYS
 *  - second-screening: high fairness boost (under-seen)
 *  - repertory: craft-led catalog mainstay
 */

export type FeedLane = 'premiere' | 'repertory' | 'second-screening';

export type FeedRankInput = {
  id: string;
  publishedAt: Date | string;
  likeCount?: number;
  commentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  /** Times opened/watched in the app — preferred under-seen signal */
  impressionCount?: number;
};

export type FeedRankedItem<T extends FeedRankInput> = T & {
  feedScore: number;
  feedLane: FeedLane;
  feedReasons: string[];
};

/** Opening-week spotlight only (boost, not later penalty). */
export const PREMIERE_DAYS = 7;

/** Prior mean for Bayesian rating (skeptical until enough votes). */
const BAYES_PRIOR_MEAN = 3.6;
const BAYES_PRIOR_STRENGTH = 4;

/** Global day key for stable daily reordering among peers. */
export function repertoryDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

/** Deterministic 0..1 from id + day — reshuffles shelf daily without decay death. */
export function dailyRotationSalt(id: string, dayKey: string): number {
  let h = 2166136261;
  const s = `${dayKey}:${id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Bayesian average so one 5★ doesn't dominate; quality compounds with more votes. */
export function craftScore(ratingAvg: number, ratingCount: number): number {
  const n = Math.max(0, ratingCount || 0);
  const avg = ratingAvg > 0 ? ratingAvg : BAYES_PRIOR_MEAN;
  const bayes =
    (BAYES_PRIOR_STRENGTH * BAYES_PRIOR_MEAN + n * avg) / (BAYES_PRIOR_STRENGTH + n);
  // Map ~1–5 stars → 0–1
  return Math.min(1, Math.max(0, (bayes - 1) / 4));
}

/**
 * Under-seen fairness: low impressions (or low total engagement as proxy)
 * → higher score. Famous films still win via craft, but don't permanently
 * smother the catalog.
 */
export function fairnessScore(input: FeedRankInput): number {
  const impressions = Math.max(0, input.impressionCount ?? 0);
  const engagement =
    Math.max(0, input.likeCount || 0) +
    Math.max(0, input.commentCount || 0) * 2 +
    Math.max(0, input.ratingCount || 0) * 3;

  // Prefer real impressions; fall back to engagement as "already seen" proxy
  const exposure = impressions > 0 ? impressions : engagement * 4;
  // Asymptotic: never goes to zero for popular films, always >0 for new ones
  return 1 / (1 + Math.log1p(exposure));
}

/** Audience signal without time — log-scaled so mega-hits don't nuke everyone. */
export function audienceScore(input: FeedRankInput): number {
  const likes = Math.max(0, input.likeCount || 0);
  const comments = Math.max(0, input.commentCount || 0);
  const raw = Math.log1p(likes) + 1.4 * Math.log1p(comments);
  // Soft cap
  return Math.min(1, raw / 8);
}

/** Opening-week boost only. After premiere window: 0 — not a penalty. */
export function premiereBoost(publishedAt: Date | string, now = new Date()): number {
  const t = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(t.getTime())) return 0;
  const ageMs = now.getTime() - t.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return 0.06;
  if (ageDays > PREMIERE_DAYS) return 0;
  // Spice only — must not outrank proven craft
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
  const premiere = premiereBoost(input.publishedAt, now);
  const salt = dailyRotationSalt(input.id, dayKey);

  // Craft forever dominant; fairness keeps catalog alive; premiere is light spice only
  const score =
    0.5 * craft +
    0.2 * audience +
    0.22 * fairness +
    premiere + // ~0–0.08
    0.06 * salt;

  const reasons: string[] = [];
  if (premiere > 0.03) reasons.push('Opening week on the marquee');
  if (craft >= 0.55 && (input.ratingCount || 0) >= 3) reasons.push('Strong craft / ratings');
  if (fairness >= 0.55) reasons.push('Second screening — under-seen in the catalog');
  if (audience >= 0.4) reasons.push('Audience heat (likes & discussion)');
  if (!reasons.length) reasons.push('In repertory rotation');

  let lane: FeedLane = 'repertory';
  // Proven craft stays repertory even in opening week
  if (premiere > 0.04 && craft < 0.65) lane = 'premiere';
  else if (fairness >= 0.6 && craft < 0.7) lane = 'second-screening';
  else if (fairness >= 0.55 && (input.impressionCount || 0) < 20 && craft < 0.65) {
    lane = 'second-screening';
  }

  return { score, lane, reasons };
}

/**
 * Rank a page of feed items. Stable secondary key: publishedAt desc among ties.
 */
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
  id: 'repertoire-v1',
  name: 'Repertory Rotation',
  tagline: 'Cinema catalog — films stay in rotation. No death-by-decay timeline.',
  principles: [
    'No time decay that zeros out older posts',
    'Craft (ratings) keeps great work alive forever',
    'Under-seen fairness resurfaces catalog gems',
    'Opening week is a spotlight boost only',
    'Daily salt reshuffles peers so the shelf feels alive',
  ],
} as const;
