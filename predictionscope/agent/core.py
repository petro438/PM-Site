"""
PredictionScope Agent - Core Loop
Runs daily to observe markets, plan content, generate articles, and queue for review.
"""

import os
import json
import yaml
import logging
from datetime import datetime, timedelta
from pathlib import Path

from planner import ContentPlanner
from writer import ContentWriter
from publisher import ContentPublisher
from monitor import PerformanceMonitor
from linker import LinkGraphManager

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(f"logs/agent-{datetime.now().strftime('%Y-%m-%d')}.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("predictionscope")


class PredictionScopeAgent:
    """
    The core agent that orchestrates the daily content pipeline.

    Loop:
        1. OBSERVE  - Pull fresh market data from Kalshi/Polymarket
        2. ANALYZE  - Identify trending markets, big movers, upcoming events
        3. PLAN     - Decide what content to create today
        4. CREATE   - Generate articles via Claude API
        5. QUEUE    - Submit drafts as GitHub PRs for human review
        6. MONITOR  - Check performance of previously published content
        7. LEARN    - Adjust strategy based on what's working
    """

    def __init__(self, config_path: str = "config/agent.yaml"):
        self.config = self._load_config(config_path)
        self.planner = ContentPlanner(self.config)
        self.writer = ContentWriter(self.config)
        self.publisher = ContentPublisher(self.config)
        self.monitor = PerformanceMonitor(self.config)
        self.linker = LinkGraphManager(self.config)

        self.run_date = datetime.now()
        self.run_id = self.run_date.strftime("%Y%m%d-%H%M%S")

        logger.info(f"Agent initialized. Run ID: {self.run_id}")

    def _load_config(self, path: str) -> dict:
        with open(path, "r") as f:
            return yaml.safe_load(f)

    def run(self, dry_run: bool = False):
        """Execute the full daily agent loop."""
        logger.info("=" * 60)
        logger.info(f"Starting daily run: {self.run_id}")
        logger.info("=" * 60)

        try:
            # Step 1: OBSERVE - Gather fresh market data
            logger.info("Step 1: OBSERVE - Pulling market data...")
            market_data = self._observe()

            # Step 2: ANALYZE - Find opportunities
            logger.info("Step 2: ANALYZE - Identifying content opportunities...")
            opportunities = self._analyze(market_data)

            # Step 3: PLAN - Decide what to write today
            logger.info("Step 3: PLAN - Creating content plan...")
            content_plan = self._plan(opportunities)

            # Step 4: CREATE - Generate the content
            logger.info(f"Step 4: CREATE - Generating {len(content_plan)} articles...")
            articles = self._create(content_plan, market_data)

            # Step 5: QUEUE - Submit for review
            if not dry_run:
                logger.info("Step 5: QUEUE - Submitting drafts for review...")
                self._queue(articles)
            else:
                logger.info("Step 5: QUEUE - DRY RUN, skipping publish queue")
                self._save_drafts(articles)

            # Step 6: MONITOR - Check existing content performance
            logger.info("Step 6: MONITOR - Checking content performance...")
            performance = self._monitor()

            # Step 7: LEARN - Update strategy
            logger.info("Step 7: LEARN - Updating strategy from performance data...")
            self._learn(performance)

            self._save_run_log(content_plan, articles, performance)
            logger.info(f"Daily run complete. {len(articles)} articles generated.")

        except Exception as e:
            logger.error(f"Agent run failed: {e}", exc_info=True)
            self._notify_error(e)

    # -------------------------------------------------------------------------
    # Step 1: OBSERVE
    # -------------------------------------------------------------------------
    def _observe(self) -> dict:
        """Pull fresh data from all market sources."""
        from data_sources.kalshi import KalshiClient
        from data_sources.polymarket import PolymarketClient

        data = {"timestamp": self.run_date.isoformat(), "kalshi": {}, "polymarket": {}}

        # Kalshi markets
        try:
            kalshi = KalshiClient(os.environ.get("KALSHI_API_KEY"))
            data["kalshi"]["markets"] = kalshi.get_active_markets()
            data["kalshi"]["movers"] = kalshi.get_biggest_movers(hours=24)
            data["kalshi"]["upcoming"] = kalshi.get_events_closing_soon(days=7)
            logger.info(
                f"Kalshi: {len(data['kalshi']['markets'])} active markets, "
                f"{len(data['kalshi']['movers'])} big movers"
            )
        except Exception as e:
            logger.warning(f"Kalshi data pull failed: {e}")

        # Polymarket markets
        try:
            poly = PolymarketClient()
            data["polymarket"]["markets"] = poly.get_active_markets()
            data["polymarket"]["movers"] = poly.get_biggest_movers(hours=24)
            data["polymarket"]["trending"] = poly.get_trending()
            logger.info(
                f"Polymarket: {len(data['polymarket']['markets'])} active markets, "
                f"{len(data['polymarket']['movers'])} big movers"
            )
        except Exception as e:
            logger.warning(f"Polymarket data pull failed: {e}")

        # Save daily snapshot
        snapshot_path = f"data/market-snapshots/{self.run_date.strftime('%Y-%m-%d')}.json"
        os.makedirs(os.path.dirname(snapshot_path), exist_ok=True)
        with open(snapshot_path, "w") as f:
            json.dump(data, f, indent=2, default=str)

        return data

    # -------------------------------------------------------------------------
    # Step 2: ANALYZE
    # -------------------------------------------------------------------------
    def _analyze(self, market_data: dict) -> list[dict]:
        """
        Use Claude to analyze market data and identify content opportunities.
        Returns a ranked list of potential article topics.
        """
        from anthropic import Anthropic

        client = Anthropic()

        # Build context for Claude
        existing_content = self.linker.get_content_inventory()
        config = self.config

        prompt = f"""You are the content strategist for PredictionScope, a prediction market 
media site. Analyze the following market data and identify the best content opportunities 
for today.

EXISTING CONTENT (don't duplicate):
{json.dumps(existing_content, indent=2)}

TODAY'S MARKET DATA:
{json.dumps(self._summarize_market_data(market_data), indent=2)}

CONTENT BUCKET WEIGHTS:
- Educational (/learn/): {config['content_buckets']['learn']['weight']}
- Topical (/markets/): {config['content_buckets']['markets']['weight']}
- Affiliate (/best/): {config['content_buckets']['best']['weight']}

Identify 3-7 content opportunities. For each, provide:
1. bucket: "learn" | "markets" | "best"
2. slug: URL-friendly slug
3. title: SEO-optimized title
4. description: 2-3 sentence summary of the article
5. target_keywords: List of 2-5 target keywords
6. priority: 1-10 (10 = highest)
7. reasoning: Why this content should be created today
8. market_data_needed: What specific data points to include

Respond ONLY with a JSON array. No preamble."""

        response = client.messages.create(
            model=config["agent"]["model"],
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            opportunities = json.loads(response.content[0].text)
            logger.info(f"Identified {len(opportunities)} content opportunities")
            return sorted(opportunities, key=lambda x: x.get("priority", 0), reverse=True)
        except json.JSONDecodeError:
            logger.error("Failed to parse opportunities from Claude response")
            return []

    def _summarize_market_data(self, data: dict) -> dict:
        """Condense market data to fit in Claude's context efficiently."""
        summary = {"date": data["timestamp"], "highlights": []}

        for source in ["kalshi", "polymarket"]:
            if source in data and "movers" in data[source]:
                for market in data[source]["movers"][:10]:
                    summary["highlights"].append(
                        {
                            "source": source,
                            "title": market.get("title", ""),
                            "price": market.get("yes_price", market.get("price", "")),
                            "change_24h": market.get("change_24h", ""),
                            "volume": market.get("volume", ""),
                            "category": market.get("category", ""),
                            "close_date": market.get("close_date", ""),
                        }
                    )

        return summary

    # -------------------------------------------------------------------------
    # Step 3: PLAN
    # -------------------------------------------------------------------------
    def _plan(self, opportunities: list[dict]) -> list[dict]:
        """
        Select which opportunities to execute today.
        Respects max_articles_per_run and bucket weights.
        """
        return self.planner.create_daily_plan(
            opportunities=opportunities,
            max_articles=self.config["agent"]["max_articles_per_run"],
        )

    # -------------------------------------------------------------------------
    # Step 4: CREATE
    # -------------------------------------------------------------------------
    def _create(self, content_plan: list[dict], market_data: dict) -> list[dict]:
        """Generate full articles for each item in the content plan."""
        articles = []
        for item in content_plan:
            try:
                article = self.writer.generate_article(
                    plan_item=item,
                    market_data=market_data,
                    existing_content=self.linker.get_content_inventory(),
                )
                articles.append(article)
                logger.info(f"Generated: {item['title']} ({item['bucket']})")
            except Exception as e:
                logger.error(f"Failed to generate '{item['title']}': {e}")

        return articles

    # -------------------------------------------------------------------------
    # Step 5: QUEUE
    # -------------------------------------------------------------------------
    def _queue(self, articles: list[dict]):
        """Submit articles as GitHub PRs for human review."""
        for article in articles:
            try:
                pr_url = self.publisher.create_review_pr(article)
                logger.info(f"PR created: {pr_url}")
                self._notify_new_draft(article, pr_url)
            except Exception as e:
                logger.error(f"Failed to queue '{article['title']}': {e}")

    def _save_drafts(self, articles: list[dict]):
        """Save drafts locally for dry run inspection."""
        for article in articles:
            bucket = article["bucket"]
            slug = article["slug"]
            path = f"content/{bucket}/{slug}.md"
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w") as f:
                f.write(article["content"])
            logger.info(f"Draft saved: {path}")

    # -------------------------------------------------------------------------
    # Step 6: MONITOR
    # -------------------------------------------------------------------------
    def _monitor(self) -> dict:
        """Check performance of published content."""
        return self.monitor.get_performance_report()

    # -------------------------------------------------------------------------
    # Step 7: LEARN
    # -------------------------------------------------------------------------
    def _learn(self, performance: dict):
        """
        Adjust agent strategy based on performance data.
        This is where the agent gets smarter over time.
        """
        # Track which content types perform best
        if performance.get("top_performers"):
            logger.info("Top performing content:")
            for page in performance["top_performers"][:5]:
                logger.info(f"  {page['url']}: {page['impressions']} impressions")

        # Track rejection reasons to improve content quality
        rejections = self.publisher.get_recent_rejections()
        if rejections:
            logger.info(f"Recent rejections: {len(rejections)}")
            for r in rejections:
                logger.info(f"  {r['title']}: {r['reason']}")

    # -------------------------------------------------------------------------
    # Utilities
    # -------------------------------------------------------------------------
    def _save_run_log(self, plan, articles, performance):
        """Save a complete log of this run for later analysis."""
        log = {
            "run_id": self.run_id,
            "timestamp": self.run_date.isoformat(),
            "articles_planned": len(plan),
            "articles_generated": len(articles),
            "plan": plan,
            "articles": [
                {"title": a["title"], "bucket": a["bucket"], "slug": a["slug"]}
                for a in articles
            ],
            "performance_snapshot": performance,
        }
        log_path = f"logs/runs/{self.run_id}.json"
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        with open(log_path, "w") as f:
            json.dump(log, f, indent=2, default=str)

    def _notify_new_draft(self, article: dict, pr_url: str):
        """Send notification that a new draft is ready for review."""
        # Implement Slack/email notification
        logger.info(f"[NOTIFY] New draft ready: {article['title']} → {pr_url}")

    def _notify_error(self, error: Exception):
        """Send notification on agent failure."""
        logger.error(f"[NOTIFY] Agent error: {error}")


# =============================================================================
# CLI Entry Point
# =============================================================================
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="PredictionScope Agent")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate content but don't queue for publish",
    )
    parser.add_argument(
        "--config",
        default="config/agent.yaml",
        help="Path to agent config file",
    )
    args = parser.parse_args()

    agent = PredictionScopeAgent(config_path=args.config)
    agent.run(dry_run=args.dry_run)
