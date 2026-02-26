"""
PredictionScope Link Graph Manager
Maintains the internal link graph across all content.
Ensures proper cross-linking between content buckets.
"""

import os
import json
import yaml
import logging
from pathlib import Path

logger = logging.getLogger("predictionscope")


class LinkGraphManager:
    """Manages internal linking across the site's content."""

    def __init__(self, config: dict):
        self.config = config
        self.site_map_path = "config/site-map.yaml"
        self.content_dirs = {
            "learn": "content/learn",
            "markets": "content/markets",
            "best": "content/best",
        }

    def get_content_inventory(self) -> list[dict]:
        """
        Scan all content directories and return inventory.
        Each item includes slug, title, bucket, status, and outbound links.
        """
        inventory = []

        for bucket, dir_path in self.content_dirs.items():
            if not os.path.exists(dir_path):
                continue

            for filename in os.listdir(dir_path):
                if not filename.endswith(".md"):
                    continue

                filepath = os.path.join(dir_path, filename)
                metadata = self._extract_frontmatter(filepath)

                inventory.append(
                    {
                        "slug": filename.replace(".md", ""),
                        "bucket": bucket,
                        "title": metadata.get("title", filename),
                        "status": metadata.get("status", "draft"),
                        "target_keywords": metadata.get("target_keywords", []),
                        "url": f"/{bucket}/{filename.replace('.md', '')}",
                        "internal_links": self._extract_links(filepath),
                        "word_count": metadata.get("word_count", 0),
                    }
                )

        return inventory

    def suggest_links(self, article_bucket: str, article_keywords: list[str]) -> list[dict]:
        """
        Suggest internal links for a new article based on its bucket and keywords.

        Rules:
        - Every topical article should link to at least 1 educational article
        - Every topical article should link to at least 1 affiliate page
        - Educational articles should link to related educational content
        - Affiliate pages should link to educational explainers
        """
        inventory = self.get_content_inventory()
        published = [item for item in inventory if item.get("status") == "published"]
        suggestions = []

        # Always suggest core pages
        always_link = self.config.get("linking", {}).get("always_link_to", [])
        for url in always_link:
            matching = [item for item in published if item["url"] == url]
            if matching:
                suggestions.append(
                    {
                        "target": url,
                        "title": matching[0]["title"],
                        "reason": "core_page",
                    }
                )

        # Keyword-based suggestions
        keywords_lower = set(kw.lower() for kw in article_keywords)
        for item in published:
            if item["bucket"] == article_bucket and item["url"] in [
                s["target"] for s in suggestions
            ]:
                continue

            item_keywords = set(kw.lower() for kw in item.get("target_keywords", []))
            overlap = keywords_lower & item_keywords

            if overlap:
                suggestions.append(
                    {
                        "target": item["url"],
                        "title": item["title"],
                        "reason": f"keyword_overlap: {overlap}",
                    }
                )

        # Cross-bucket linking
        if article_bucket == "markets":
            # Link to educational content
            learn_pages = [item for item in published if item["bucket"] == "learn"]
            for page in learn_pages[:3]:
                if page["url"] not in [s["target"] for s in suggestions]:
                    suggestions.append(
                        {
                            "target": page["url"],
                            "title": page["title"],
                            "reason": "cross_bucket_learn",
                        }
                    )

            # Link to affiliate pages
            best_pages = [item for item in published if item["bucket"] == "best"]
            for page in best_pages[:1]:
                if page["url"] not in [s["target"] for s in suggestions]:
                    suggestions.append(
                        {
                            "target": page["url"],
                            "title": page["title"],
                            "reason": "cross_bucket_affiliate",
                        }
                    )

        max_links = self.config.get("linking", {}).get("max_internal_links_per_article", 8)
        return suggestions[:max_links]

    def audit_links(self) -> dict:
        """
        Audit the internal link graph.
        Find orphan pages (no inbound links) and pages that need more links.
        """
        inventory = self.get_content_inventory()
        published = [item for item in inventory if item.get("status") == "published"]

        # Count inbound links per page
        inbound_counts = {item["url"]: 0 for item in published}
        for item in published:
            for link in item.get("internal_links", []):
                if link in inbound_counts:
                    inbound_counts[link] += 1

        orphans = [url for url, count in inbound_counts.items() if count == 0]
        under_linked = [
            url for url, count in inbound_counts.items() if 0 < count < 2
        ]

        return {
            "total_pages": len(published),
            "orphan_pages": orphans,
            "under_linked_pages": under_linked,
            "average_inbound_links": (
                sum(inbound_counts.values()) / len(inbound_counts)
                if inbound_counts
                else 0
            ),
        }

    def _extract_frontmatter(self, filepath: str) -> dict:
        """Extract YAML frontmatter from a markdown file."""
        try:
            with open(filepath, "r") as f:
                content = f.read()
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    return yaml.safe_load(parts[1]) or {}
        except Exception:
            pass
        return {}

    def _extract_links(self, filepath: str) -> list[str]:
        """Extract internal links from markdown content."""
        import re

        links = []
        try:
            with open(filepath, "r") as f:
                content = f.read()
            # Match markdown links that start with /
            pattern = r"\[.*?\]\((\/[^)]+)\)"
            links = re.findall(pattern, content)
        except Exception:
            pass
        return links
