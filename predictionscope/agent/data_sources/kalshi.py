"""
Kalshi API Client for PredictionScope
Pulls market data, price history, and event information.
"""

import os
import requests
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("predictionscope")

KALSHI_API_BASE = "https://api.elections.kalshi.com/trade-api/v2"


class KalshiClient:
    """Client for the Kalshi prediction market API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("KALSHI_API_KEY", "")
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({"Authorization": f"Bearer {self.api_key}"})

    def get_active_markets(self, limit: int = 100, category: str = None) -> list[dict]:
        """Fetch active markets from Kalshi."""
        params = {"limit": limit, "status": "open"}
        if category:
            params["series_ticker"] = category

        try:
            resp = self.session.get(f"{KALSHI_API_BASE}/markets", params=params)
            resp.raise_for_status()
            data = resp.json()
            markets = data.get("markets", [])

            return [
                {
                    "id": m.get("ticker", ""),
                    "title": m.get("title", ""),
                    "subtitle": m.get("subtitle", ""),
                    "yes_price": m.get("yes_bid", 0) / 100 if m.get("yes_bid") else None,
                    "no_price": m.get("no_bid", 0) / 100 if m.get("no_bid") else None,
                    "volume": m.get("volume", 0),
                    "open_interest": m.get("open_interest", 0),
                    "category": m.get("category", ""),
                    "close_date": m.get("close_time", ""),
                    "source": "kalshi",
                }
                for m in markets
            ]
        except requests.RequestException as e:
            logger.error(f"Kalshi API error: {e}")
            return []

    def get_biggest_movers(self, hours: int = 24, limit: int = 20) -> list[dict]:
        """
        Find markets with the biggest price moves in the last N hours.
        Note: This requires comparing snapshots since Kalshi doesn't have a 
        native "movers" endpoint. Uses stored snapshots for comparison.
        """
        current_markets = self.get_active_markets(limit=200)

        # Load yesterday's snapshot for comparison
        yesterday = (datetime.now() - timedelta(hours=hours)).strftime("%Y-%m-%d")
        snapshot_path = f"data/market-snapshots/{yesterday}.json"

        try:
            import json

            with open(snapshot_path, "r") as f:
                old_data = json.load(f)
            old_markets = {
                m["id"]: m for m in old_data.get("kalshi", {}).get("markets", [])
            }
        except (FileNotFoundError, json.JSONDecodeError):
            logger.warning(f"No snapshot found for {yesterday}, can't compute movers")
            # Return markets sorted by volume as fallback
            return sorted(current_markets, key=lambda x: x.get("volume", 0), reverse=True)[
                :limit
            ]

        # Calculate price changes
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

        # Sort by absolute change
        movers.sort(key=lambda x: abs(x.get("change_24h", 0)), reverse=True)
        return movers[:limit]

    def get_events_closing_soon(self, days: int = 7) -> list[dict]:
        """Get markets closing within the next N days."""
        markets = self.get_active_markets(limit=200)
        cutoff = datetime.now() + timedelta(days=days)

        closing_soon = []
        for m in markets:
            close_date = m.get("close_date", "")
            if close_date:
                try:
                    close_dt = datetime.fromisoformat(close_date.replace("Z", "+00:00"))
                    if close_dt.replace(tzinfo=None) <= cutoff:
                        m["days_until_close"] = (
                            close_dt.replace(tzinfo=None) - datetime.now()
                        ).days
                        closing_soon.append(m)
                except ValueError:
                    pass

        closing_soon.sort(key=lambda x: x.get("days_until_close", 999))
        return closing_soon

    def get_market_history(self, ticker: str, days: int = 30) -> list[dict]:
        """Get price history for a specific market."""
        try:
            params = {
                "limit": days,
                "period_interval": 1,  # Daily
            }
            resp = self.session.get(
                f"{KALSHI_API_BASE}/markets/{ticker}/history", params=params
            )
            resp.raise_for_status()
            return resp.json().get("history", [])
        except requests.RequestException as e:
            logger.error(f"Kalshi history error for {ticker}: {e}")
            return []
