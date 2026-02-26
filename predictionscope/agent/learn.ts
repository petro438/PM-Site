/**
 * agent/learn.ts
 * 
 * Weekly performance analysis. Reviews Google Search Console data
 * and adjusts agent strategy based on what's working.
 * 
 * Run manually or via cron: `npm run agent:learn`
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const client = new Anthropic();

interface PerformanceEntry {
  slug: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
}

function loadInventory(): any[] {
  const path = 'data/inventory.json';
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return [];
  }
}

function loadGSCData(): PerformanceEntry[] {
  // In production, this would pull from Google Search Console API.
  // For now, it reads from a manually updated JSON file.
  const path = 'data/gsc-data.json';
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
    return {};
  }
}

export async function learn(): Promise<void> {
  console.log('[Learn] Starting weekly performance analysis...');

  const inventory = loadInventory();
  const gscData = loadGSCData();
  const config = loadAgentConfig();

  if (inventory.length === 0) {
    console.log('[Learn] No content in inventory yet. Skipping.');
    return;
  }

  // Merge inventory with GSC data
  const enrichedInventory = inventory.map(item => {
    const gsc = gscData.find(g => g.slug === item.slug);
    return {
      ...item,
      impressions: gsc?.impressions || 0,
      clicks: gsc?.clicks || 0,
      ctr: gsc?.ctr || 0,
      avgPosition: gsc?.avgPosition || 0,
    };
  });

  const prompt = `You are analyzing the performance of PredictionScope.com content. Based on the data below, provide a weekly report and strategic recommendations.

## Current Content Inventory & Performance

${enrichedInventory.map(item =>
    `- "${item.title}" [${item.bucket}] — Impressions: ${item.impressions}, Clicks: ${item.clicks}, CTR: ${(item.ctr * 100).toFixed(1)}%, Avg Position: ${item.avgPosition.toFixed(1)}`
  ).join('\n')}

## Current Agent Config

- Bucket weights: Educational ${(config.bucketWeights?.educational * 100 || 50).toFixed(0)}%, Topical ${(config.bucketWeights?.topical * 100 || 35).toFixed(0)}%, Affiliate ${(config.bucketWeights?.affiliate * 100 || 15).toFixed(0)}%
- Max articles per run: ${config.maxArticlesPerRun || 3}

## Total Published: ${inventory.length} articles
- Educational: ${inventory.filter((i: any) => i.bucket === 'educational').length}
- Topical: ${inventory.filter((i: any) => i.bucket === 'topical').length}
- Affiliate: ${inventory.filter((i: any) => i.bucket === 'affiliate').length}

## Your Task

1. Produce a weekly performance summary (what's working, what isn't)
2. Identify articles ranking on page 2 (positions 11-20) that could be optimized
3. Identify content gaps — what should we write next?
4. Recommend updated bucket weights if the current mix isn't working
5. Flag any articles that should be updated or refreshed

Respond in JSON format:
{
  "summary": "2-3 paragraph weekly report",
  "topPerformers": ["slug1", "slug2"],
  "optimizationCandidates": [{"slug": "...", "reason": "..."}],
  "contentGaps": ["suggested topic 1", "suggested topic 2"],
  "recommendedBucketWeights": {"educational": 0.4, "topical": 0.45, "affiliate": 0.15},
  "refreshNeeded": [{"slug": "...", "reason": "..."}]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);

    // Save the report
    const reportPath = `data/reports/weekly-${new Date().toISOString().split('T')[0]}.json`;
    const reportsDir = 'data/reports';
    const { mkdirSync: mkdir } = await import('fs');
    mkdir(reportsDir, { recursive: true });
    writeFileSync(reportPath, JSON.stringify(analysis, null, 2), 'utf-8');

    // Update agent config with recommended bucket weights
    if (analysis.recommendedBucketWeights) {
      const updatedConfig = {
        ...config,
        bucketWeights: analysis.recommendedBucketWeights,
        lastUpdated: new Date().toISOString(),
      };
      writeFileSync('data/agent-config.json', JSON.stringify(updatedConfig, null, 2), 'utf-8');
      console.log('[Learn] Updated agent config with new bucket weights');
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('WEEKLY REPORT');
    console.log('='.repeat(60));
    console.log(analysis.summary);
    console.log('\nOptimization candidates:', analysis.optimizationCandidates?.length || 0);
    console.log('Content gaps identified:', analysis.contentGaps?.length || 0);
    console.log('Refresh needed:', analysis.refreshNeeded?.length || 0);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('[Learn] Error:', error);
  }
}

// Run directly if called
learn().catch(console.error);
