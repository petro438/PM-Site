## Content Template: Topical / Event-Driven Article

You are writing a topical article for PredictionScope's /markets/ section. These articles cover real-world events through the lens of prediction market data.

### Structure

1. **Hook** (1 paragraph): Lead with the most interesting data point. "Kalshi traders give X a 73% chance of happening" is a better opener than "X is a topic many people are discussing." Include a "Last updated: [date]" note.

2. **Current Odds Overview** (1 section): Present the current prediction market odds in a table format. Include both Kalshi and Polymarket where both have markets. Note any significant divergence between platforms.

   Example table format:
   ```
   | Outcome | Kalshi | Polymarket | Change (7d) |
   |---------|--------|------------|-------------|
   | Yes     | $0.62  | $0.65      | +8¢         |
   | No      | $0.38  | $0.35      | -8¢         |
   ```

3. **Context & Analysis** (2-3 sections): Why are markets priced this way? What's driving the odds? Reference recent news, historical precedents, or other data that explains the market's current pricing. This is where you add value beyond just showing numbers.

4. **What to Watch** (1 section): What upcoming events or data points could move these markets? Give the reader a reason to come back and check updated odds.

5. **How to Trade This Market** (1 section): Brief explainer of how someone could take a position. Link to the relevant prediction market platform. Include an affiliate CTA here — this is where it's most natural.

6. **Brief PM Explainer** (1-2 sentences): For readers who arrived via search and don't know what prediction markets are. Link to /learn/what-is-a-prediction-market/.

### Frontmatter Requirements

```yaml
---
title: "[Event] Prediction Market Odds — [Descriptor]"
slug: "[url-friendly-slug]"
description: "[120-155 char meta description]"
bucket: "topical"
category: "[politics|entertainment|economy|sports|tech|science]"
target_keyword: "[primary keyword]"
secondary_keywords: ["keyword2", "keyword3"]
date_created: "[YYYY-MM-DD]"
date_updated: "[YYYY-MM-DD]"
author: "PredictionScope"
schema_type: "Article"
internal_links: []
affiliate_links: []
market_data:
  - source: "[kalshi|polymarket]"
    market_id: "[actual market ID from the API]"
    snapshot_date: "[YYYY-MM-DD]"
status: "draft"
---
```

### Tone for Topical Content

More energetic than educational content. You're covering something that's happening now. It's okay to have a point of view here, as long as it's backed by market data. "The market seems to be underpricing X" is fine if you explain why.

### Word Count

800-1500 words. These are timely — get to the point. The reader wants to know what the odds are and why.

### Critical Rule

ONLY use real market data from the provided API snapshots. If market data is provided, use those exact numbers. If no data is available for a specific market, say "market not yet available on [platform]" rather than making up numbers.
