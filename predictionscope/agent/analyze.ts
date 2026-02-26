/**
 * agent/analyze.ts
 * 
 * Takes observations and scores potential content opportunities.
 * This module uses Claude to make the editorial judgment call.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { Observations, MarketData } from './observe';

const client = new Anthropic();

export interface ContentOpportunity {
  title: string;
  slug: string;
  bucket: 'educational' | 'topical' | 'affiliate';
  category: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  score: number;
  reasoning: string;
  relevantMarkets: MarketData[];
}

function loadInventory(): string[] {
  const path = 'data/inventory.json';
  if (!existsSync(path)) return [];
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return data.map((item: any) => item.slug);
  } catch {
    return [];
  }
}

function loadSeedKeywords(): any[] {
  const path = 'data/seed-keywords.json';
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
}

function loadAgentConfig(): any {
  const path = 'data/agent-config.json';
  if (!existsSync(path)) {
    return {
      bucketWeights: { educational: 0.5, topical: 0.35, affiliate: 0.15 },
      maxArticlesPerRun: 3,
      minScoreThreshold: 0.4,
    };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { bucketWeights: { educational: 0.5, topical: 0.35, affiliate: 0.15 } };
  }
}

function formatMarketsForPrompt(markets: MarketData[]): string {
  if (markets.length === 0) return 'No market data available.';

  // Group by category, show top markets by volume
  const byCategory = new Map<string, MarketData[]>();
  for (const m of markets) {
    const cat = m.category || 'general';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(m);
  }

  let output = '';
  for (const [category, items] of byCategory) {
    const top = items.sort((a, b) => b.volume - a.volume).slice(0, 5);
    output += `\n### ${category}\n`;
    for (const m of top) {
      output += `- [${m.platform}] "${m.title}" — Yes: $${m.yes_price.toFixed(2)}, Volume: ${m.volume.toLocaleString()}\n`;
    }
  }

  return output;
}

export async function analyze(observations: Observations): Promise<ContentOpportunity[]> {
  console.log('[Analyze] Scoring content opportunities...');

  const existingSlugs = loadInventory();
  const seedKeywords = loadSeedKeywords();
  const config = loadAgentConfig();

  const prompt = `You are the editorial brain of PredictionScope.com. Your job is to analyze the current prediction market landscape and recommend what articles to write today.

## Current Market Data

### Kalshi Markets (${observations.kalshiMarkets.length} active)
${formatMarketsForPrompt(observations.kalshiMarkets)}

### Polymarket Markets (${observations.polymarketMarkets.length} active)
${formatMarketsForPrompt(observations.polymarketMarkets)}

### Big Movers (>10% price change in 24h)
${observations.movers.length > 0
    ? observations.movers.map(m => `- [${m.platform}] "${m.title}" — Now: $${m.yes_price.toFixed(2)}`).join('\n')
    : 'No major movers detected.'}

### Trending News Headlines
${observations.newsHeadlines.slice(0, 15).map(h => `- ${h}`).join('\n')}

## Existing Content (already published)
${existingSlugs.length > 0 ? existingSlugs.map(s => `- ${s}`).join('\n') : 'No content published yet.'}

## Seed Keywords (pre-researched targets)
${seedKeywords.slice(0, 30).map((k: any) => `- "${k.keyword}" (volume: ${k.volume || 'unknown'}, bucket: ${k.bucket || 'unknown'})`).join('\n')}

## Current Bucket Priorities
- Educational: ${(config.bucketWeights.educational * 100).toFixed(0)}% priority
- Topical: ${(config.bucketWeights.topical * 100).toFixed(0)}% priority  
- Affiliate: ${(config.bucketWeights.affiliate * 100).toFixed(0)}% priority

## Your Task

Recommend 3-5 articles to produce. For each, provide:
1. A compelling title optimized for search
2. A URL slug
3. The content bucket (educational, topical, or affiliate)
4. A category (politics, entertainment, economy, sports, tech, learn, best)
5. The primary target keyword
6. 2-3 secondary keywords
7. A relevance score from 0 to 1 (how important/timely is this?)
8. Brief reasoning (1-2 sentences)
9. Which market IDs from the data above are relevant (if any)

Do NOT recommend articles for slugs that already exist in the inventory.
Balance across buckets according to the priority weights.
Prioritize timeliness for topical content and gaps in coverage for educational content.

Respond ONLY with valid JSON in this format (no markdown fences, no other text):
[
  {
    "title": "Article Title Here",
    "slug": "url-friendly-slug",
    "bucket": "educational|topical|affiliate",
    "category": "politics|entertainment|economy|sports|tech|learn|best",
    "targetKeyword": "primary keyword",
    "secondaryKeywords": ["kw2", "kw3"],
    "score": 0.85,
    "reasoning": "Why this article, why now.",
    "relevantMarketIds": ["MARKET-ID-1"]
  }
]`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const recommendations = JSON.parse(cleaned);

    // Attach relevant market data to each opportunity
    const allMarkets = [...observations.kalshiMarkets, ...observations.polymarketMarkets];
    const opportunities: ContentOpportunity[] = recommendations.map((rec: any) => ({
      ...rec,
      relevantMarkets: (rec.relevantMarketIds || [])
        .map((id: string) => allMarkets.find(m => m.id === id))
        .filter(Boolean),
    }));

    // Sort by score descending
    opportunities.sort((a, b) => b.score - a.score);

    console.log(`[Analyze] Generated ${opportunities.length} content opportunities`);
    for (const opp of opportunities) {
      console.log(`  [${opp.score.toFixed(2)}] ${opp.bucket}: "${opp.title}"`);
    }

    return opportunities;
  } catch (error) {
    console.error('[Analyze] Error:', error);
    return [];
  }
}
