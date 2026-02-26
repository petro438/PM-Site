/**
 * agent/create.ts
 * 
 * Generates article content using Claude API.
 * This is where the actual writing happens.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'fs';
import { ContentOpportunity } from './analyze';
import { MarketData } from './observe';

const client = new Anthropic();

function loadPrompt(filename: string): string {
  const path = `agent/prompts/${filename}`;
  if (!existsSync(path)) {
    console.warn(`[Create] Prompt file not found: ${path}`);
    return '';
  }
  return readFileSync(path, 'utf-8');
}

function loadLinkMap(): Record<string, { slug: string; title: string; anchor: string }[]> {
  const path = 'data/link-map.json';
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

function formatMarketDataForArticle(markets: MarketData[]): string {
  if (markets.length === 0) return 'No specific market data available for this topic.';

  return markets.map(m =>
    `- Platform: ${m.platform}\n  Market: "${m.title}"\n  ID: ${m.id}\n  Yes Price: $${m.yes_price.toFixed(2)}\n  Volume: ${m.volume.toLocaleString()}\n  URL: ${m.url}`
  ).join('\n\n');
}

function getSuggestedInternalLinks(
  bucket: string,
  category: string
): string {
  const linkMap = loadLinkMap();

  // Always suggest linking to core pages
  const suggestions = [
    '- /learn/what-is-a-prediction-market/ (anchor: "prediction market" or "prediction markets")',
    '- /best/prediction-market-apps/ (anchor: "best prediction market apps")',
  ];

  if (bucket === 'topical') {
    suggestions.push('- /learn/how-to-read-prediction-market-odds/ (anchor: "reading odds" or "understanding odds")');
  }

  if (bucket === 'educational') {
    suggestions.push('- /best/kalshi-review/ (anchor: "Kalshi")');
    suggestions.push('- /best/kalshi-vs-polymarket/ (anchor: "Kalshi vs Polymarket")');
  }

  return suggestions.join('\n');
}

function getDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export interface DraftArticle {
  slug: string;
  bucket: string;
  category: string;
  content: string;    // Full markdown with frontmatter
  title: string;
  targetKeyword: string;
  wordCount: number;
}

export async function create(
  assignment: ContentOpportunity
): Promise<DraftArticle> {
  console.log(`[Create] Writing: "${assignment.title}" (${assignment.bucket})`);

  const systemPrompt = loadPrompt('system.md');
  const templatePrompt = loadPrompt(`${assignment.bucket}.md`);
  const marketContext = formatMarketDataForArticle(assignment.relevantMarkets);
  const internalLinks = getSuggestedInternalLinks(assignment.bucket, assignment.category);
  const today = getDateString();

  const userPrompt = `${templatePrompt}

## Assignment

- Title: ${assignment.title}
- Slug: ${assignment.slug}
- Target keyword: ${assignment.targetKeyword}
- Secondary keywords: ${assignment.secondaryKeywords.join(', ')}
- Content bucket: ${assignment.bucket}
- Category: ${assignment.category}
- Today's date: ${today}

## Current Market Data (use ONLY these real numbers)

${marketContext}

## Suggested Internal Links

${internalLinks}

## Instructions

Write the complete article now, starting with the YAML frontmatter block.

Use the exact slug "${assignment.slug}" in the frontmatter.
Use today's date (${today}) for date_created and date_updated.
Include the suggested internal links in the frontmatter AND naturally within the article body.
Use real market data where provided. Never fabricate numbers.

Output the complete markdown file content, starting with --- for the frontmatter.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Clean up: remove any markdown code fences the model might wrap around the output
    const cleaned = content
      .replace(/^```markdown\n?/m, '')
      .replace(/^```yaml\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    const wordCount = cleaned.split(/\s+/).length;

    console.log(`[Create] Done: "${assignment.title}" — ${wordCount} words`);

    return {
      slug: assignment.slug,
      bucket: assignment.bucket,
      category: assignment.category,
      content: cleaned,
      title: assignment.title,
      targetKeyword: assignment.targetKeyword,
      wordCount,
    };
  } catch (error) {
    console.error(`[Create] Error writing "${assignment.title}":`, error);
    throw error;
  }
}
