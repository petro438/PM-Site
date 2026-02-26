"""
PredictionScope Content Planner
Decides which content to create each day based on opportunities,
existing content inventory, and strategic priorities.
"""

import json
import logging
from datetime import datetime
from collections import Counter

logger = logging.getLogger("predictionscope")


class ContentPlanner:
    """Plans daily content based on bucket weights, gaps, and opportunities."""

    def __init__(self, config: dict):
        self.config = config
        self.buckets = config.get("content_buckets", {})
        self.phases = config.get("phases", {})

    def create_daily_plan(
        self, opportunities: list[dict], max_articles: int = 5
    ) -> list[dict]:
        """
        Select which opportunities to execute today.

        Strategy:
        1. Determine current phase and target content mix
        2. Check what buckets are underrepresented
        3. Select highest-priority items that balance the mix
        4. Respect max_articles limit
        """
        current_phase = self._determine_phase()
        target_mix = current_phase.get(
            "content_mix",
            {"learn": 0.50, "markets": 0.35, "best": 0.15},
        )

        logger.info(f"Current phase: {current_phase.get('name', 'unknown')}")
        logger.info(f"Target mix: {target_mix}")

        # Count what we have in each bucket
        bucket_counts = Counter(op["bucket"] for op in opportunities)
        logger.info(f"Opportunities by bucket: {dict(bucket_counts)}")

        # Allocate slots per bucket
        slots = {}
        remaining = max_articles
        for bucket, weight in sorted(target_mix.items(), key=lambda x: -x[1]):
            allocated = max(1, round(max_articles * weight))
            slots[bucket] = min(allocated, remaining)
            remaining -= slots[bucket]

        # If we have remaining slots, give them to the highest-weight bucket
        if remaining > 0:
            top_bucket = max(target_mix, key=target_mix.get)
            slots[top_bucket] += remaining

        logger.info(f"Slot allocation: {slots}")

        # Fill slots with highest-priority opportunities per bucket
        plan = []
        for bucket, num_slots in slots.items():
            bucket_opps = [
                op for op in opportunities if op.get("bucket") == bucket
            ]
            bucket_opps.sort(key=lambda x: x.get("priority", 0), reverse=True)
            selected = bucket_opps[:num_slots]
            plan.extend(selected)

        # Sort final plan by priority
        plan.sort(key=lambda x: x.get("priority", 0), reverse=True)

        # Trim to max
        plan = plan[:max_articles]

        logger.info(f"Daily plan: {len(plan)} articles")
        for item in plan:
            logger.info(
                f"  [{item['bucket']}] {item['title']} (priority: {item.get('priority', '?')})"
            )

        return plan

    def _determine_phase(self) -> dict:
        """Determine which phase the agent is in based on content inventory."""
        # For now, default to phase 1
        # TODO: Check actual content counts and metrics against phase criteria
        from linker import LinkGraphManager

        try:
            linker = LinkGraphManager(self.config)
            inventory = linker.get_content_inventory()
            total_published = len(
                [c for c in inventory if c.get("status") == "published"]
            )

            phase_1 = self.phases.get("phase_1", {})
            phase_2 = self.phases.get("phase_2", {})
            phase_3 = self.phases.get("phase_3", {})

            if total_published >= 100:
                logger.info("Phase 3: Monetization")
                return phase_3
            elif total_published >= 50:
                logger.info("Phase 2: Growth")
                return phase_2
            else:
                logger.info("Phase 1: Foundation")
                return phase_1

        except Exception:
            return self.phases.get(
                "phase_1",
                {
                    "name": "Foundation",
                    "content_mix": {"learn": 0.55, "markets": 0.35, "best": 0.10},
                },
            )

    def get_content_gaps(self) -> list[dict]:
        """Identify missing educational content that should exist."""
        # Core educational topics every PM site needs
        core_topics = [
            {
                "slug": "what-are-prediction-markets",
                "title": "What Are Prediction Markets? A Complete Guide",
                "priority": 10,
                "bucket": "learn",
                "target_keywords": [
                    "what are prediction markets",
                    "prediction markets explained",
                ],
            },
            {
                "slug": "how-prediction-markets-work",
                "title": "How Do Prediction Markets Work?",
                "priority": 10,
                "bucket": "learn",
                "target_keywords": [
                    "how prediction markets work",
                    "prediction market mechanics",
                ],
            },
            {
                "slug": "prediction-markets-vs-polls",
                "title": "Prediction Markets vs. Polls: Which Is More Accurate?",
                "priority": 9,
                "bucket": "learn",
                "target_keywords": [
                    "prediction markets vs polls",
                    "are prediction markets accurate",
                ],
            },
            {
                "slug": "are-prediction-markets-legal",
                "title": "Are Prediction Markets Legal in the US?",
                "priority": 9,
                "bucket": "learn",
                "target_keywords": [
                    "are prediction markets legal",
                    "prediction market regulation",
                ],
            },
            {
                "slug": "how-to-read-prediction-market-odds",
                "title": "How to Read Prediction Market Odds (Beginner's Guide)",
                "priority": 9,
                "bucket": "learn",
                "target_keywords": [
                    "prediction market odds",
                    "how to read prediction markets",
                ],
            },
            {
                "slug": "what-is-kalshi",
                "title": "What Is Kalshi? Everything You Need to Know",
                "priority": 8,
                "bucket": "learn",
                "target_keywords": ["what is kalshi", "kalshi explained"],
            },
            {
                "slug": "what-is-polymarket",
                "title": "What Is Polymarket? A Complete Beginner's Guide",
                "priority": 8,
                "bucket": "learn",
                "target_keywords": ["what is polymarket", "polymarket explained"],
            },
            {
                "slug": "prediction-markets-history",
                "title": "The History of Prediction Markets: From Iowa to Kalshi",
                "priority": 6,
                "bucket": "learn",
                "target_keywords": [
                    "prediction market history",
                    "history of prediction markets",
                ],
            },
            {
                "slug": "prediction-markets-vs-sports-betting",
                "title": "Prediction Markets vs. Sports Betting: What's the Difference?",
                "priority": 7,
                "bucket": "learn",
                "target_keywords": [
                    "prediction markets vs sports betting",
                    "prediction markets gambling",
                ],
            },
            {
                "slug": "cftc-prediction-markets",
                "title": "The CFTC and Prediction Markets: Regulation Explained",
                "priority": 6,
                "bucket": "learn",
                "target_keywords": [
                    "CFTC prediction markets",
                    "prediction market regulation",
                ],
            },
            {
                "slug": "prediction-market-strategies",
                "title": "Prediction Market Trading Strategies for Beginners",
                "priority": 7,
                "bucket": "learn",
                "target_keywords": [
                    "prediction market strategies",
                    "how to trade prediction markets",
                ],
            },
            {
                "slug": "prediction-market-taxes",
                "title": "Prediction Market Taxes: What You Need to Know",
                "priority": 7,
                "bucket": "learn",
                "target_keywords": [
                    "prediction market taxes",
                    "do I pay taxes on prediction markets",
                ],
            },
        ]

        return core_topics
