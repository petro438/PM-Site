/**
 * scripts/seed-content.ts
 * 
 * Generates the initial batch of educational articles to build
 * the site's foundation layer. Run once during setup.
 * 
 * Usage: npm run agent:seed
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const client = new Anthropic();

// Core educational articles every prediction market site needs
const SEED_ARTICLES = [
  {
    title: 'What Is a Prediction Market? A Complete Guide',
    slug: 'what-is-a-prediction-market',
    targetKeyword: 'what is a prediction market',
    secondaryKeywords: ['prediction market definition', 'how prediction markets work', 'prediction market explained'],
  },
  {
    title: 'How to Read Prediction Market Odds',
    slug: 'how-to-read-prediction-market-odds',
    targetKeyword: 'how to read prediction market odds',
    secondaryKeywords: ['prediction market odds explained', 'understanding prediction market prices'],
  },
  {
    title: 'Are Prediction Markets Legal? A State-by-State Guide',
    slug: 'are-prediction-markets-legal',
    targetKeyword: 'are prediction markets legal',
    secondaryKeywords: ['prediction markets legal US', 'CFTC prediction markets', 'prediction market regulations'],
  },
  {
    title: 'How Accurate Are Prediction Markets? What the Data Shows',
    slug: 'how-accurate-are-prediction-markets',
    targetKeyword: 'how accurate are prediction markets',
    secondaryKeywords: ['prediction market accuracy', 'prediction markets vs polls accuracy'],
  },
  {
    title: 'Prediction Markets vs. Polls: Which Is More Reliable?',
    slug: 'prediction-markets-vs-polls',
    targetKeyword: 'prediction markets vs polls',
    secondaryKeywords: ['are prediction markets better than polls', 'prediction markets polling comparison'],
  },
  {
    title: 'Prediction Markets vs. Sports Betting: Key Differences',
    slug: 'prediction-markets-vs-sports-betting',
    targetKeyword: 'prediction markets vs sports betting',
    secondaryKeywords: ['difference between prediction markets and betting', 'prediction market or sportsbook'],
  },
  {
    title: 'How to Start Trading Prediction Markets: A Beginner\'s Guide',
    slug: 'prediction-market-beginners-guide',
    targetKeyword: 'prediction market for beginners',
    secondaryKeywords: ['how to trade prediction markets', 'getting started prediction markets'],
  },
  {
    title: 'Do You Pay Taxes on Prediction Market Winnings?',
    slug: 'prediction-market-taxes',
    targetKeyword: 'prediction market tax',
    secondaryKeywords: ['do you pay taxes on prediction markets', 'kalshi taxes', '1099 prediction markets'],
  },
  {
    title: 'Prediction Market Glossary: Every Term You Need to Know',
    slug: 'prediction-market-glossary',
    targetKeyword: 'prediction market glossary',
    secondaryKeywords: ['prediction market terms', 'prediction market definitions'],
  },
  {
    title: 'The History of Prediction Markets: From Iowa to Kalshi',
    slug: 'history-of-prediction-markets',
    targetKeyword: 'history of prediction markets',
    secondaryKeywords: ['when did prediction markets start', 'prediction market timeline'],
  },
];

async function generateArticle(article: typeof SEED_ARTICLES[0]): Promise<string> {
  const systemPrompt = readFileSync('agent/prompts/system.md', 'utf-8');
  const templatePrompt = readFileSync('agent/prompts/educational.md', 'utf-8');
  const today = new Date().toISOString().split('T')[0];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `${templatePrompt}

## Assignment

- Title: ${article.title}
- Slug: ${article.slug}
- Target keyword: ${article.targetKeyword}
- Secondary keywords: ${article.secondaryKeywords.join(', ')}
- Content bucket: educational
- Category: learn
- Today's date: ${today}

## Suggested Internal Links

- /learn/what-is-a-prediction-market/ (anchor: "prediction market" — skip if this IS that article)
- /best/prediction-market-apps/ (anchor: "best prediction market apps")
- /best/kalshi-review/ (anchor: "Kalshi")
- /best/kalshi-vs-polymarket/ (anchor: "Kalshi vs Polymarket")
- /learn/how-to-read-prediction-market-odds/ (anchor: "reading prediction market odds")

## Instructions

Write the complete article now, starting with the YAML frontmatter block.
Set status to "draft" — these will be reviewed before publishing.
Use real, factual information about prediction markets. Reference Kalshi (CFTC-regulated), Polymarket, and PredictIt where relevant.
Do NOT fabricate specific odds or prices — use general examples or hypothetical illustrations clearly labeled as such.

Output the complete markdown file content.`,
    }],
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  return content.replace(/^```markdown\n?/m, '').replace(/\n?```$/m, '').trim();
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   PredictionScope — Seed Content Gen     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const outputDir = 'site/content/learn';
  mkdirSync(outputDir, { recursive: true });

  const inventory: any[] = [];

  for (let i = 0; i < SEED_ARTICLES.length; i++) {
    const article = SEED_ARTICLES[i];
    console.log(`[${i + 1}/${SEED_ARTICLES.length}] Generating: "${article.title}"...`);

    try {
      const content = await generateArticle(article);
      const filepath = `${outputDir}/${article.slug}.md`;
      writeFileSync(filepath, content, 'utf-8');
      console.log(`  ✓ Written to ${filepath} (${content.split(/\s+/).length} words)`);

      inventory.push({
        slug: article.slug,
        title: article.title,
        bucket: 'educational',
        category: 'learn',
        targetKeyword: article.targetKeyword,
        wordCount: content.split(/\s+/).length,
        status: 'draft',
        createdAt: new Date().toISOString(),
      });

      // Small delay to avoid rate limiting
      if (i < SEED_ARTICLES.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ✗ Failed: ${error}`);
    }
  }

  // Update inventory
  mkdirSync('data', { recursive: true });
  const inventoryPath = 'data/inventory.json';
  let existing: any[] = [];
  if (existsSync(inventoryPath)) {
    try {
      existing = JSON.parse(readFileSync(inventoryPath, 'utf-8'));
    } catch {}
  }
  const merged = [...existing, ...inventory.filter(
    item => !existing.some((e: any) => e.slug === item.slug)
  )];
  writeFileSync(inventoryPath, JSON.stringify(merged, null, 2));

  console.log(`\n✓ Generated ${inventory.length} seed articles`);
  console.log('Review drafts in site/content/learn/ before publishing.');
}

main().catch(console.error);
