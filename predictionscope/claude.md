# PredictionScope

## What This Is
PredictionScope is an AI-agent-operated media site covering the world through prediction markets. An autonomous agent fetches market data from Kalshi and Polymarket, decides what content to produce, writes articles using Claude API, and submits them as GitHub PRs for human review before publishing.

## Architecture
- **Agent** (`agent/`): TypeScript orchestration that runs on GitHub Actions cron. Calls Claude API for editorial decisions and content generation. All other operations (data fetching, file I/O, git) are regular code.
- **Site** (`site/`): Next.js 14 App Router, Tailwind CSS, deployed on Vercel. Content stored as markdown files in `site/content/`.
- **Data** (`data/`): JSON files for keyword lists, content inventory, link maps, and agent config.

## Content Buckets
1. **Educational** (`/learn/`): Evergreen explainers about prediction markets. Foundation layer for SEO authority.
2. **Topical** (`/markets/`): Event-driven content using real PM odds as context. Politics, entertainment, economy, sports.
3. **Affiliate** (`/best/`): Commercial pages for "best prediction market apps", platform reviews, promo codes.

## Key Rules
- Never fabricate market data. Always pull real odds from APIs.
- Write as "PredictionScope" or "we" — never as AI.
- Every page must have proper frontmatter, internal links, and schema markup.
- Affiliate pages require manual verification of promo codes before publishing.
- The agent submits PRs — it never merges its own PRs.

## Running
- `npm run agent` — Run the agent loop once (fetches data, decides content, writes drafts, opens PR)
- `npm run agent:seed` — Generate initial educational content library
- `npm run agent:learn` — Run weekly performance analysis
- `npm run dev` — Start Next.js dev server

## Environment Variables
- `ANTHROPIC_API_KEY` — Claude API key
- `GITHUB_TOKEN` — GitHub personal access token (for PR creation)
- `KALSHI_API_KEY` — Kalshi API key (optional, public endpoints work for basic data)
- `SLACK_WEBHOOK_URL` — Slack webhook for notifications (optional)
