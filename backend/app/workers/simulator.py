from __future__ import annotations

import asyncio
import random
from datetime import UTC, datetime
from decimal import Decimal

from app.core.config import get_settings
from app.core.constants import PRICE_TICK_STREAM, symbol_last_price_key
from app.db.redis import redis_client

PRICE_STEP_BASIS_POINTS = 250
MIN_PRICE = Decimal("1.00")
PRICE_PRECISION = Decimal("0.0001")


def _next_price(current_price: Decimal) -> Decimal:
    delta_bps = Decimal(random.randint(-PRICE_STEP_BASIS_POINTS, PRICE_STEP_BASIS_POINTS))
    multiplier = Decimal("1") + (delta_bps / Decimal("10000"))
    next_price = (current_price * multiplier).quantize(PRICE_PRECISION)
    return max(MIN_PRICE, next_price)


async def run_simulator() -> None:
    settings = get_settings()
    prices = {
        symbol: Decimal(settings.initial_prices.get(symbol, "100.00")).quantize(PRICE_PRECISION)
        for symbol in settings.symbol_list
    }

    while True:
        for symbol in settings.symbol_list:
            prices[symbol] = _next_price(prices[symbol])
            event_ts = datetime.now(UTC).isoformat()
            payload = {
                "symbol": symbol,
                "price": str(prices[symbol]),
                "event_ts": event_ts,
                "source": "simulator",
            }
            await redis_client.set(symbol_last_price_key(symbol), payload["price"])
            await redis_client.xadd(PRICE_TICK_STREAM, payload)

        await asyncio.sleep(settings.simulator_tick_interval_ms / 1000)


if __name__ == "__main__":
    asyncio.run(run_simulator())
