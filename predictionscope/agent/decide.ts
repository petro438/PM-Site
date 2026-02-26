/**
 * agent/decide.ts
 * 
 * Takes scored opportunities and selects what to actually produce.
 * Simple selection logic — no AI needed here.
 */

import { ContentOpportunity } from './analyze';

export interface DecisionConfig {
  maxArticles: number;
  bucketWeights: {
    educational: number;
    topical: number;
    affiliate: number;
  };
  minScore: number;
}

const DEFAULT_CONFIG: DecisionConfig = {
  maxArticles: 3,
  bucketWeights: {
    educational: 0.5,
    topical: 0.35,
    affiliate: 0.15,
  },
  minScore: 0.3,
};

export function decide(
  opportunities: ContentOpportunity[],
  config: Partial<DecisionConfig> = {}
): ContentOpportunity[] {
  const { maxArticles, bucketWeights, minScore } = { ...DEFAULT_CONFIG, ...config };

  console.log('[Decide] Selecting articles to produce...');

  // Filter by minimum score
  const viable = opportunities.filter(o => o.score >= minScore);

  if (viable.length === 0) {
    console.log('[Decide] No opportunities above minimum score threshold');
    return [];
  }

  // Calculate target count per bucket
  const targetCounts = {
    educational: Math.max(1, Math.round(maxArticles * bucketWeights.educational)),
    topical: Math.max(0, Math.round(maxArticles * bucketWeights.topical)),
    affiliate: Math.max(0, Math.round(maxArticles * bucketWeights.affiliate)),
  };

  // Select top opportunities per bucket, respecting targets
  const selected: ContentOpportunity[] = [];
  const bucketCounts = { educational: 0, topical: 0, affiliate: 0 };

  // First pass: fill each bucket up to its target
  for (const bucket of ['educational', 'topical', 'affiliate'] as const) {
    const bucketOpps = viable
      .filter(o => o.bucket === bucket)
      .sort((a, b) => b.score - a.score);

    const target = targetCounts[bucket];
    for (const opp of bucketOpps) {
      if (bucketCounts[bucket] >= target) break;
      if (selected.length >= maxArticles) break;
      selected.push(opp);
      bucketCounts[bucket]++;
    }
  }

  // Second pass: if we have room, fill with highest-scoring remaining
  if (selected.length < maxArticles) {
    const remaining = viable
      .filter(o => !selected.includes(o))
      .sort((a, b) => b.score - a.score);

    for (const opp of remaining) {
      if (selected.length >= maxArticles) break;
      selected.push(opp);
    }
  }

  console.log(`[Decide] Selected ${selected.length} articles:`);
  for (const s of selected) {
    console.log(`  [${s.bucket}] "${s.title}" (score: ${s.score.toFixed(2)})`);
  }

  return selected;
}
