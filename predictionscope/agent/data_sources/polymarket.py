"""
Polymarket API Client for PredictionScope
Pulls market data from the Polymarket CLOB API.
"""

import os
import requests
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("predictionscope")

POLYMARKET_CLOB_BASE = "https://clob.polymarket.com"
POLYMARKET_GAMMA_BASE = "https://gamma-api.polymarket.com"


class PolymarketClient:
    """Client for the Polymarket prediction market API."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    def get_active_markets(self, limit: int = 100) -> list[dict]:
        """Fetch active markets from Polymarket's Gamma API."""
        try:
            resp = self.session.get(
                f"{POLYMARKET_GAMMA_BASE}/markets",
                params={
                    "limit": limit,
                    "active": True,
                    "closed": False,
                    "order": "volume24hr",
                    "ascending": False,
                },
            )
            resp.raise_for_status()
            markets = resp.json()

            return [
                {
                    "id": m.get("condition_id", m.get("id", "")),
                    "title": m.get("question", ""),
                    "description": m.get("description", ""),
                    "yes_price": (
                        float(m.get("outcomePrices", "[0]").strip("[]").split(",")[0])
                        if m.get("outcomePrices")
                        else None
                    ),
                    "volume": float(m.get("volume", 0)),
                    "volume_24h": float(m.get("volume24hr", 0)),
                    "liquidity": float(m.get("liquidity", 0)),
                    "category": m.get("groupItemTitle", ""),
                    "close_date": m.get("endDate", ""),
                    "source": "polymarket",
                    "slug": m.get("slug", ""),
                    "url": f"https://polymarket.com/event/{m.get('slug', '')}",
                }
                for m in markets
                if isinstance(m, dict)
            ]
        except requests.RequestException as e:
            logger.error(f"Polymarket API error: {e}")
            return []
        except (ValueError, IndexError) as e:
            logger.error(f"Polymarket parse error: {e}")
            return []

    def get_biggest_movers(self, hours: int = 24, limit: int = 20) -> list[dict]:
        """
        Find markets with biggest price changes.
        Uses snapshot comparison similar to Kalshi client.
        """
        current_markets = self.get_active_markets(limit=200)

        # Load yesterday's snapshot
        yesterday = (datetime.now() - timedelta(hours=hours)).strftime("%Y-%m-%d")
        snapshot_path = f"data/market-snapshots/{yesterday}.json"

        try:
            import json

            with open(snapshot_path, "r") as f:
                old_data = json.load(f)
            old_markets = {
                m["id"]: m
                for m in old_data.get("polymarket", {}).get("markets", [])
            }
        except (FileNotFoundError, json.JSONDecodeError):
            logger.warning(
                f"No Polymarket snapshot for {yesterday}, returning by volume"
            )
            return sorted(
                current_markets, key=lambda x: x.get("volume_24h", 0), reverse=True
            )[:limit]

        movers = []
        for market in current_markets:
            old = old_markets.get(market["id"])
            if old and market.get("yes_price") and old.get("yes_price"):
                change = market["yes_price"] - old["yes_price"]
                market["change_24h"] = round(change, 4)
                market["change_pct"] = (
                    round(change / old["yes_price"] * 100, 2)
                    if old["yes_price"] > 0
                    else 0
                )
                movers.append(market)

        movers.sort(key=lambda x: abs(x.get("change_24h", 0)), reverse=True)
        return movers[:limit]

    def get_trending(self, limit: int = 20) -> list[dict]:
        """Get trending markets by 24h volume."""
        markets = self.get_active_markets(limit=200)
        return sorted(
            markets, key=lambda x: x.get("volume_24h", 0), reverse=True
        )[:limit]

    def get_market_detail(self, condition_id: str) -> Optional[dict]:
        """Get detailed info about a specific market."""
        try:
            resp = self.session.get(
                f"{POLYMARKET_GAMMA_BASE}/markets/{condition_id}"
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            logger.error(f"Polymarket detail error for {condition_id}: {e}")
            return None
