/**
 * agent/index.ts
 * 
 * Main entry point for the PredictionScope agent.
 * Orchestrates: observe → analyze → decide → create → submit
 * 
 * Run: `npm run agent` or triggered via GitHub Actions
 */

import { observe } from './observe';
import { analyze } from './analyze';
import { decide } from './decide';
import { create, DraftArticle } from './create';
import { submit } from './submit';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

async function loadPreviousSnapshot() {
  const path = 'data/market-snapshot.json';
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return undefined;
  }
}

function saveSnapshot(markets: any[]) {
  mkdirSync('data', { recursive: true });
  writeFileSync('data/market-snapshot.json', JSON.stringify(markets, null, 2));
}

function loadConfig() {
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

async function main() {
  const startTime = Date.now();
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   PredictionScope Agent — Starting Run   ║');
  console.log(`║   ${new Date().toISOString()}    ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    // --- Step 1: Observe ---
    console.log('▶ Step 1: Observing market landscape...\n');
    const previousSnapshot = await loadPreviousSnapshot();
    const observations = await observe({ previousSnapshot });

    // Save current snapshot for next run's comparison
    const allMarkets = [...observations.kalshiMarkets, ...observations.polymarketMarkets];
    saveSnapshot(allMarkets);

    // --- Step 2: Analyze ---
    console.log('\n▶ Step 2: Analyzing content opportunities...\n');
    const opportunities = await analyze(observations);

    if (opportunities.length === 0) {
      console.log('\n⚠ No content opportunities identified. Ending run.');
      return;
    }

    // --- Step 3: Decide ---
    console.log('\n▶ Step 3: Selecting articles to produce...\n');
    const config = loadConfig();
    const assignments = decide(opportunities, {
      maxArticles: config.maxArticlesPerRun || 3,
      bucketWeights: config.bucketWeights,
      minScore: config.minScoreThreshold || 0.3,
    });

    if (assignments.length === 0) {
      console.log('\n⚠ No articles selected. Ending run.');
      return;
    }

    // --- Step 4: Create ---
    console.log('\n▶ Step 4: Generating content...\n');
    const drafts: DraftArticle[] = [];
    for (const assignment of assignments) {
      try {
        const draft = await create(assignment);
        drafts.push(draft);
      } catch (error) {
        console.error(`✗ Failed to create "${assignment.title}":`, error);
        // Continue with other articles
      }
    }

    if (drafts.length === 0) {
      console.log('\n⚠ No drafts produced. Ending run.');
      return;
    }

    // --- Step 5: Submit ---
    console.log('\n▶ Step 5: Submitting for review...\n');
    await submit(drafts);

    // --- Summary ---
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   Run Complete                            ║');
    console.log(`║   Articles drafted: ${drafts.length}                     ║`);
    console.log(`║   Time elapsed: ${elapsed}s                   ║`);
    console.log('╚══════════════════════════════════════════╝');

    // Log decisions for audit trail
    const logEntry = {
      timestamp: new Date().toISOString(),
      observations: {
        kalshiMarkets: observations.kalshiMarkets.length,
        polymarketMarkets: observations.polymarketMarkets.length,
        movers: observations.movers.length,
        trends: observations.trendingTopics.length,
      },
      opportunities: opportunities.length,
      selected: assignments.map(a => ({
        title: a.title,
        bucket: a.bucket,
        score: a.score,
      })),
      produced: drafts.map(d => ({
        slug: d.slug,
        bucket: d.bucket,
        wordCount: d.wordCount,
      })),
      elapsedSeconds: parseFloat(elapsed),
    };

    // Append to decisions log
    const logPath = 'data/decisions.json';
    let logs: any[] = [];
    if (existsSync(logPath)) {
      try {
        logs = JSON.parse(readFileSync(logPath, 'utf-8'));
      } catch {
        logs = [];
      }
    }
    logs.push(logEntry);
    writeFileSync(logPath, JSON.stringify(logs, null, 2));

  } catch (error) {
    console.error('\n✗ Agent run failed:', error);
    process.exit(1);
  }
}

main();
