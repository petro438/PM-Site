# PredictionScope

An AI-powered prediction market media site, built and maintained by an autonomous agent with human editorial oversight.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AGENT CORE LOOP                         │
│                  (runs daily via cron)                       │
│                                                             │
│  1. OBSERVE    → Pull market data from Kalshi/Polymarket    │
│  2. ANALYZE    → Check trending topics, search demand       │
│  3. PLAN       → Decide what content to create today        │
│  4. CREATE     → Generate articles via Claude API           │
│  5. QUEUE      → Submit drafts for human review             │
│  6. PUBLISH    → On approval, build & deploy                │
│  7. MONITOR    → Track indexation, rankings, traffic        │
│  8. LEARN      → Adjust strategy based on performance       │
└─────────────────────────────────────────────────────────────┘
```

## Content Buckets

| Bucket | URL Prefix | Cadence | SEO Goal |
|--------|-----------|---------|----------|
| Educational | `/learn/` | Weekly refresh | Topical authority, internal link hub |
| Topical/Markets | `/markets/` | Daily | Traffic from event searches |
| Affiliate/Money | `/best/` | Weekly refresh | Revenue via affiliate conversions |

## Project Structure

```
predictionscope/
├── README.md                 # This file
├── agent/
│   ├── core.py              # Main agent loop
│   ├── planner.py           # Content planning & prioritization
│   ├── writer.py            # Content generation via Claude API
│   ├── publisher.py         # Markdown → site build → deploy
│   ├── monitor.py           # GSC + analytics tracking
│   └── linker.py            # Internal link graph manager
├── site/
│   ├── package.json         # Next.js dependencies
│   ├── next.config.js       # Site configuration
│   ├── tailwind.config.js   # Tailwind with PredictionScope theme
│   ├── app/
│   │   ├── layout.tsx       # Root layout with nav/footer
│   │   ├── page.tsx         # Homepage
│   │   ├── learn/
│   │   │   └── [slug]/
│   │   │       └── page.tsx # Educational article template
│   │   ├── markets/
│   │   │   └── [slug]/
│   │   │       └── page.tsx # Market/topical article template
│   │   └── best/
│   │       └── [slug]/
│   │           └── page.tsx # Affiliate/comparison template
│   └── components/
│       ├── OddsTable.tsx    # Live odds comparison component
│       ├── MarketChart.tsx  # Price history chart
│       ├── PlatformCard.tsx # Affiliate platform card
│       └── ArticleCard.tsx  # Content listing card
├── config/
│   ├── agent.yaml           # Agent behavior configuration
│   ├── brand.yaml           # Brand voice, tone, guidelines
│   ├── affiliates.yaml      # Affiliate links, promo codes
│   └── site-map.yaml        # Content inventory & link graph
├── content/
│   ├── learn/               # Educational markdown files
│   ├── markets/             # Topical markdown files
│   └── best/                # Affiliate markdown files
├── data/
│   └── market-snapshots/    # Daily market data captures
├── scripts/
│   ├── setup.sh             # Initial project setup
│   ├── run-agent.sh         # Daily agent execution
│   └── deploy.sh            # Build & deploy to Vercel
└── templates/
    ├── learn.md             # Educational article template
    ├── market.md            # Market/topical article template
    └── affiliate.md         # Affiliate article template
```

## Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd predictionscope
npm install --prefix site
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Add: ANTHROPIC_API_KEY, KALSHI_API_KEY, POLYMARKET_API_KEY, 
#       GOOGLE_SEARCH_CONSOLE_KEY, VERCEL_TOKEN

# 3. Run the agent once manually
python agent/core.py --dry-run

# 4. Set up daily cron
crontab -e
# 0 8 * * * cd /path/to/predictionscope && ./scripts/run-agent.sh
```

## How the Agent Works

### Daily Planning
The agent wakes up and evaluates:
- **Market movers**: What prediction markets had significant price changes?
- **Trending events**: What's culturally relevant right now?
- **Content gaps**: What educational topics haven't been covered yet?
- **Performance data**: What existing content is/isn't performing?

It then produces a **daily content plan** (typically 2-5 articles) balanced across buckets.

### Content Generation
Each article is generated via the Claude API with:
- A detailed system prompt encoding brand voice and SEO best practices
- Structured data from market APIs (real odds, real prices)
- Internal link suggestions from the site map
- Article-type-specific templates

### Human Review
All content goes to a **review queue** (GitHub Pull Requests). The human editor can:
- ✅ Approve and merge (triggers deploy)
- ✏️ Edit and approve
- ❌ Reject with feedback (agent learns from rejection reasons)
- 🔄 Request regeneration with notes

### Publishing
On merge, a GitHub Action:
1. Builds the Next.js site
2. Generates/updates the XML sitemap
3. Deploys to Vercel
4. Pings Google for re-indexation
5. Logs the publish event

## Budget Estimate

| Item | Monthly Cost |
|------|-------------|
| Claude API (Sonnet, ~100 articles/mo) | $30-60 |
| Vercel hosting (free tier likely fine) | $0-20 |
| Domain (predictionscope.com) | ~$1 |
| Kalshi API | Free |
| Polymarket API | Free |
| Google Search Console | Free |
| **Total** | **~$30-80/mo** |

## Metrics to Track

### Phase 1 (Months 1-2): Can the content rank?
- Pages indexed by Google
- Organic impressions (GSC)
- Any keyword rankings
- Indexation rate (% of published pages indexed within 7 days)

### Phase 2 (Months 3+): Can it monetize?
- Affiliate click-through rate
- Affiliate conversions
- Email signups (if added)
- Tool usage (if built)
