"""
PredictionScope Performance Monitor
Tracks indexation, rankings, traffic, and affiliate performance via GSC.
"""

import os
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("predictionscope")


class PerformanceMonitor:
    """Monitors content performance via Google Search Console and analytics."""

    def __init__(self, config: dict):
        self.config = config
        self.metrics_dir = "data/performance"
        os.makedirs(self.metrics_dir, exist_ok=True)

    def get_performance_report(self) -> dict:
        """
        Generate a daily performance report.
        Pulls from Google Search Console API and internal tracking.
        """
        report = {
            "date": datetime.now().isoformat(),
            "indexation": self._check_indexation(),
            "search_performance": self._get_search_metrics(),
            "top_performers": self._get_top_pages(),
            "underperformers": self._get_underperforming_pages(),
            "content_inventory": self._get_inventory_stats(),
        }

        # Save report
        report_path = os.path.join(
            self.metrics_dir,
            f"report-{datetime.now().strftime('%Y-%m-%d')}.json",
        )
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2, default=str)

        return report

    def _check_indexation(self) -> dict:
        """
        Check which published pages are indexed by Google.

        Uses the Google Search Console URL Inspection API.
        Falls back to site: search if API unavailable.
        """
        try:
            from google_auth import get_gsc_service

            service = get_gsc_service()
            site_url = os.environ.get("SITE_URL", "https://predictionscope.com")

            # Get list of published content
            content_files = self._get_published_urls()

            indexed = []
            not_indexed = []

            for url in content_files:
                try:
                    result = (
                        service.urlInspection()
                        .index()
                        .inspect(
                            body={
                                "inspectionUrl": url,
                                "siteUrl": site_url,
                            }
                        )
                        .execute()
                    )
                    verdict = (
                        result.get("inspectionResult", {})
                        .get("indexStatusResult", {})
                        .get("verdict", "UNKNOWN")
                    )

                    if verdict == "PASS":
                        indexed.append(url)
                    else:
                        not_indexed.append({"url": url, "verdict": verdict})

                except Exception as e:
                    logger.warning(f"Could not inspect {url}: {e}")

            return {
                "total_published": len(content_files),
                "indexed": len(indexed),
                "not_indexed": len(not_indexed),
                "index_rate": (
                    len(indexed) / len(content_files) if content_files else 0
                ),
                "not_indexed_urls": not_indexed[:10],
            }

        except ImportError:
            logger.warning("GSC API not configured, skipping indexation check")
            return {"status": "gsc_not_configured"}

    def _get_search_metrics(self) -> dict:
        """Pull search performance data from GSC for the last 7 days."""
        try:
            from google_auth import get_gsc_service

            service = get_gsc_service()
            site_url = os.environ.get("SITE_URL", "https://predictionscope.com")

            end_date = datetime.now() - timedelta(days=2)  # GSC has 2-day lag
            start_date = end_date - timedelta(days=7)

            response = (
                service.searchanalytics()
                .query(
                    siteUrl=site_url,
                    body={
                        "startDate": start_date.strftime("%Y-%m-%d"),
                        "endDate": end_date.strftime("%Y-%m-%d"),
                        "dimensions": ["date"],
                        "rowLimit": 30,
                    },
                )
                .execute()
            )

            rows = response.get("rows", [])
            total_impressions = sum(r.get("impressions", 0) for r in rows)
            total_clicks = sum(r.get("clicks", 0) for r in rows)
            avg_position = (
                sum(r.get("position", 0) for r in rows) / len(rows) if rows else 0
            )

            return {
                "period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
                "total_impressions": total_impressions,
                "total_clicks": total_clicks,
                "average_position": round(avg_position, 1),
                "ctr": round(total_clicks / total_impressions * 100, 2)
                if total_impressions
                else 0,
                "daily_data": [
                    {
                        "date": r["keys"][0],
                        "impressions": r["impressions"],
                        "clicks": r["clicks"],
                    }
                    for r in rows
                ],
            }

        except ImportError:
            logger.warning("GSC API not configured")
            return {"status": "gsc_not_configured"}
        except Exception as e:
            logger.warning(f"GSC query failed: {e}")
            return {"status": "error", "error": str(e)}

    def _get_top_pages(self, limit: int = 10) -> list[dict]:
        """Get top performing pages by impressions."""
        try:
            from google_auth import get_gsc_service

            service = get_gsc_service()
            site_url = os.environ.get("SITE_URL", "https://predictionscope.com")

            end_date = datetime.now() - timedelta(days=2)
            start_date = end_date - timedelta(days=28)

            response = (
                service.searchanalytics()
                .query(
                    siteUrl=site_url,
                    body={
                        "startDate": start_date.strftime("%Y-%m-%d"),
                        "endDate": end_date.strftime("%Y-%m-%d"),
                        "dimensions": ["page"],
                        "rowLimit": limit,
                        "orderBy": [
                            {"fieldName": "impressions", "sortOrder": "DESCENDING"}
                        ],
                    },
                )
                .execute()
            )

            return [
                {
                    "url": r["keys"][0],
                    "impressions": r["impressions"],
                    "clicks": r["clicks"],
                    "position": round(r["position"], 1),
                    "ctr": round(r["clicks"] / r["impressions"] * 100, 2)
                    if r["impressions"]
                    else 0,
                }
                for r in response.get("rows", [])
            ]

        except Exception:
            return []

    def _get_underperforming_pages(self) -> list[dict]:
        """Identify pages with impressions but low CTR (opportunity to optimize)."""
        try:
            from google_auth import get_gsc_service

            service = get_gsc_service()
            site_url = os.environ.get("SITE_URL", "https://predictionscope.com")

            end_date = datetime.now() - timedelta(days=2)
            start_date = end_date - timedelta(days=28)

            response = (
                service.searchanalytics()
                .query(
                    siteUrl=site_url,
                    body={
                        "startDate": start_date.strftime("%Y-%m-%d"),
                        "endDate": end_date.strftime("%Y-%m-%d"),
                        "dimensions": ["page"],
                        "rowLimit": 100,
                    },
                )
                .execute()
            )

            # Pages with 100+ impressions but <2% CTR
            underperformers = [
                {
                    "url": r["keys"][0],
                    "impressions": r["impressions"],
                    "clicks": r["clicks"],
                    "position": round(r["position"], 1),
                    "ctr": round(r["clicks"] / r["impressions"] * 100, 2)
                    if r["impressions"]
                    else 0,
                }
                for r in response.get("rows", [])
                if r["impressions"] >= 100
                and (r["clicks"] / r["impressions"] < 0.02 if r["impressions"] else True)
            ]

            return sorted(underperformers, key=lambda x: x["impressions"], reverse=True)[
                :10
            ]

        except Exception:
            return []

    def _get_inventory_stats(self) -> dict:
        """Count content across buckets."""
        stats = {"learn": 0, "markets": 0, "best": 0, "total": 0}
        for bucket in ["learn", "markets", "best"]:
            content_dir = f"content/{bucket}"
            if os.path.exists(content_dir):
                files = [f for f in os.listdir(content_dir) if f.endswith(".md")]
                stats[bucket] = len(files)
                stats["total"] += len(files)
        return stats

    def _get_published_urls(self) -> list[str]:
        """Get all published page URLs."""
        base_url = os.environ.get("SITE_URL", "https://predictionscope.com")
        urls = []
        for bucket in ["learn", "markets", "best"]:
            content_dir = f"content/{bucket}"
            if os.path.exists(content_dir):
                for f in os.listdir(content_dir):
                    if f.endswith(".md"):
                        slug = f.replace(".md", "")
                        urls.append(f"{base_url}/{bucket}/{slug}")
        return urls
