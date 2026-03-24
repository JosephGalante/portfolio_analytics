from __future__ import annotations

from uuid import UUID

PRICE_TICK_STREAM = "price_ticks"
PORTFOLIO_UPDATES_CHANNEL_PREFIX = "portfolio_updates"


def portfolio_valuation_key(portfolio_id: UUID) -> str:
    return f"portfolio:{portfolio_id}:valuation"


def symbol_last_price_key(symbol: str) -> str:
    return f"symbol:{symbol.upper()}:last_price"


def portfolio_updates_channel(portfolio_id: UUID) -> str:
    return f"{PORTFOLIO_UPDATES_CHANNEL_PREFIX}:{portfolio_id}"
