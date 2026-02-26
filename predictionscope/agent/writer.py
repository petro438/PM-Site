"""
PredictionScope Content Writer
Generates articles via the Claude API using real market data, 
brand guidelines, and SEO best practices.
"""

import os
import json
import yaml
from datetime import datetime
from pathlib import Path


class ContentWriter:
    """Generates articles using Claude API with structured prompts per content type."""

    def __init__(self, config: dict):
        self.config = config
        self.brand = config.get("brand", {})
        self.affiliates = self._load_affiliates()
        self.templates = self._load_templates()

    def _load_affiliates(self) -> dict:
        try:
            with open("config/affiliates.yaml", "r") as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            return {}

    def _load_templates(self) -> dict:
        templates = {}
        for bucket in ["learn", "market", "affiliate"]:
            path = f"templates/{bucket}.md"
            if os.path.exists(path):
                with open(path, "r") as f:
                    templates[bucket] = f.read()
        return templates

    def generate_article(
        self, plan_item: dict, market_data: dict, existing_content: list
    ) -> dict:
        """
        Generate a complete article based on the content plan item.

        Returns dict with:
            - title, slug, bucket, content (markdown), meta_description,
              target_keywords, internal_links, schema_data
        """
        from anthropic import Anthropic

        client = Anthropic()
        bucket = plan_item["bucket"]

        # Build the prompt based on content type
        if bucket == "learn":
            system_prompt = self._build_learn_prompt(plan_item, existing_content)
        elif bucket == "markets":
            system_prompt = self._build_markets_prompt(
                plan_item, market_data, existing_content
            )
        elif bucket == "best":
            system_prompt = self._build_affiliate_prompt(plan_item, existing_content)
        else:
            raise ValueError(f"Unknown bucket: {bucket}")

        # Generate the article
        response = client.messages.create(
            model=self.config["agent"]["model"],
            max_tokens=8192,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Write the article: {plan_item['title']}\n\n"
                    f"Target keywords: {', '.join(plan_item.get('target_keywords', []))}\n"
                    f"Description: {plan_item.get('description', '')}\n\n"
                    f"Respond with ONLY the JSON object as specified in your instructions.",
                }
            ],
        )

        # Parse the response
        try:
            raw = response.content[0].text
            # Handle potential markdown wrapping
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
            article_data = json.loads(raw)
        except (json.JSONDecodeError, IndexError) as e:
            # Fallback: treat the whole response as content
            article_data = {
                "content": response.content[0].text,
                "meta_description": plan_item.get("description", ""),
                "internal_links": [],
            }

        # Merge plan metadata with generated content
        article = {
            "title": plan_item["title"],
            "slug": plan_item["slug"],
            "bucket": bucket,
            "content": article_data.get("content", ""),
            "meta_description": article_data.get(
                "meta_description", plan_item.get("description", "")
            ),
            "target_keywords": plan_item.get("target_keywords", []),
            "internal_links": article_data.get("internal_links", []),
            "schema_type": self.config["content_buckets"][bucket]["seo"][
                "schema_types"
            ][0],
            "generated_at": datetime.now().isoformat(),
            "word_count": len(article_data.get("content", "").split()),
            "market_data_snapshot": self._extract_relevant_data(
                plan_item, market_data
            ),
        }

        # Build the final markdown file with frontmatter
        article["content"] = self._build_markdown(article)

        return article

    # -------------------------------------------------------------------------
    # Prompt Builders
    # -------------------------------------------------------------------------

    def _build_learn_prompt(self, plan_item: dict, existing_content: list) -> str:
        """System prompt for educational/explainer articles."""
        word_range = (
            f"{self.config['content_buckets']['learn']['min_word_count']}-"
            f"{self.config['content_buckets']['learn']['max_word_count']}"
        )
        return f"""You are the lead writer for PredictionScope, a media site that explains 
prediction markets to a mainstream audience.

BRAND VOICE:
{self.brand.get('voice', '')}

CONTENT GUIDELINES:
{json.dumps(self.brand.get('guidelines', []), indent=2)}

FORBIDDEN CONTENT:
{json.dumps(self.brand.get('forbidden', []), indent=2)}

YOUR TASK: Write an educational article for the /learn/ section of PredictionScope.

REQUIREMENTS:
- Word count: {word_range} words
- Write for someone who has never heard of prediction markets
- Use clear, jargon-free language — explain every concept
- Include concrete examples using real prediction markets
- Structure with clear H2/H3 headings for scannability and SEO
- Include a natural FAQ section at the end (3-5 questions)
- Suggest 2-5 internal links to other PredictionScope pages

EXISTING CONTENT ON SITE (link to these where relevant):
{json.dumps([c['slug'] for c in existing_content[:30]], indent=2)}

SEO GUIDELINES:
- Include the primary keyword in the first paragraph
- Use the primary keyword in at least one H2
- Include related keywords naturally throughout
- Write a compelling meta description (150-160 chars)

RESPOND WITH A JSON OBJECT:
{{
    "content": "The full article in markdown format (H2s as ##, H3s as ###)",
    "meta_description": "150-160 char SEO meta description",
    "internal_links": [
        {{"anchor_text": "text to link", "target": "/learn/slug-here"}}
    ],
    "faq": [
        {{"question": "...", "answer": "..."}}
    ]
}}"""

    def _build_markets_prompt(
        self, plan_item: dict, market_data: dict, existing_content: list
    ) -> str:
        """System prompt for topical/market-driven articles."""
        relevant_data = self._extract_relevant_data(plan_item, market_data)
        word_range = (
            f"{self.config['content_buckets']['markets']['min_word_count']}-"
            f"{self.config['content_buckets']['markets']['max_word_count']}"
        )
        return f"""You are the lead writer for PredictionScope, a media site that covers 
current events through the lens of prediction markets.

BRAND VOICE:
{self.brand.get('voice', '')}

YOUR TASK: Write a topical article for the /markets/ section of PredictionScope.

REAL MARKET DATA (use these exact numbers):
{json.dumps(relevant_data, indent=2)}

REQUIREMENTS:
- Word count: {word_range} words
- Lead with what's happening in the real world, then bring in the prediction market angle
- Always include specific odds/prices from the data provided — never make up numbers
- Explain what prediction market prices mean in plain English
- Compare prices across platforms when data is available (Kalshi vs Polymarket)
- Include context: why are markets pricing this way? What would change the odds?
- Link to educational content to explain PM concepts to new readers
- Include a "What the Markets Say" summary box at the top

EXISTING CONTENT ON SITE (link to these where relevant):
{json.dumps([c['slug'] for c in existing_content[:30]], indent=2)}

IMPORTANT:
- Do NOT frame this as investment advice
- Include real data only — never fabricate odds or prices
- Note when markets are thinly traded (low volume/liquidity)
- If data is limited, acknowledge it rather than speculating

RESPOND WITH A JSON OBJECT:
{{
    "content": "The full article in markdown format",
    "meta_description": "150-160 char SEO meta description",
    "internal_links": [
        {{"anchor_text": "text to link", "target": "/learn/slug-here"}}
    ],
    "market_summary": {{
        "headline": "One-line market summary",
        "kalshi_price": "X¢",
        "polymarket_price": "X¢",
        "direction": "up | down | stable",
        "volume_24h": "$X"
    }}
}}"""

    def _build_affiliate_prompt(self, plan_item: dict, existing_content: list) -> str:
        """System prompt for affiliate/comparison articles."""
        # Get relevant platform data
        platforms = self.affiliates.get("platforms", {})
        disclosures = self.affiliates.get("disclosures", {})
        word_range = (
            f"{self.config['content_buckets']['best']['min_word_count']}-"
            f"{self.config['content_buckets']['best']['max_word_count']}"
        )

        return f"""You are the lead writer for PredictionScope. You're writing an honest, 
useful comparison/review article for the /best/ section.

BRAND VOICE:
{self.brand.get('voice', '')}

PLATFORM DATA (use this for accuracy):
{json.dumps(platforms, indent=2, default=str)}

REQUIRED DISCLOSURES (include at the top of the article):
Affiliate: {disclosures.get('affiliate_disclosure', '')}
Risk: {disclosures.get('risk_disclosure', '')}

YOUR TASK: Write an affiliate article that is genuinely useful.

REQUIREMENTS:
- Word count: {word_range} words
- Be honest about pros AND cons of each platform
- Include clear comparison criteria (fees, markets, UX, regulation, etc.)
- Structure with a clear recommendation framework
- Include step-by-step signup instructions where relevant
- This must be MORE useful than competing articles, not just SEO-optimized
- Include both affiliate disclosure and risk disclosure
- Naturally link to educational content explaining PM concepts

IMPORTANT:
- Never fabricate features or promo codes
- If a promo code field is empty, say "check the platform for current offers"
- Don't oversell — being honest builds more trust and converts better
- Include genuine drawbacks and who each platform is NOT for

EXISTING CONTENT ON SITE:
{json.dumps([c['slug'] for c in existing_content[:30]], indent=2)}

RESPOND WITH A JSON OBJECT:
{{
    "content": "The full article in markdown format with comparison tables",
    "meta_description": "150-160 char SEO meta description",
    "internal_links": [
        {{"anchor_text": "text to link", "target": "/learn/slug-here"}}
    ],
    "platforms_mentioned": ["kalshi", "polymarket"]
}}"""

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------

    def _extract_relevant_data(self, plan_item: dict, market_data: dict) -> dict:
        """Pull out market data relevant to a specific article topic."""
        relevant = {"extracted_for": plan_item["title"], "markets": []}

        keywords = set()
        for kw in plan_item.get("target_keywords", []):
            keywords.update(kw.lower().split())
        keywords.update(plan_item.get("title", "").lower().split())

        for source in ["kalshi", "polymarket"]:
            if source not in market_data:
                continue
            for market_list_key in ["markets", "movers", "trending", "upcoming"]:
                markets = market_data[source].get(market_list_key, [])
                if not isinstance(markets, list):
                    continue
                for market in markets:
                    title = market.get("title", "").lower()
                    if any(kw in title for kw in keywords if len(kw) > 3):
                        relevant["markets"].append(
                            {"source": source, **market}
                        )

        return relevant

    def _build_markdown(self, article: dict) -> str:
        """Wrap article content in markdown with YAML frontmatter."""
        frontmatter = {
            "title": article["title"],
            "slug": article["slug"],
            "bucket": article["bucket"],
            "meta_description": article["meta_description"],
            "target_keywords": article["target_keywords"],
            "schema_type": article["schema_type"],
            "generated_at": article["generated_at"],
            "word_count": article["word_count"],
            "status": "draft",
        }

        # Get the raw content (strip any frontmatter if Claude included it)
        content = article.get("content", "")
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                content = parts[2].strip()

        return f"""---
{yaml.dump(frontmatter, default_flow_style=False).strip()}
---

{content}
"""
