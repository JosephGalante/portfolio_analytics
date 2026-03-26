from __future__ import annotations

import asyncio
import logging

from app.core.config import get_settings
from app.db.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.services import holding_service, market_data_service

logger = logging.getLogger(__name__)


async def run_market_data_poller() -> None:
    settings = get_settings()

    while True:
        async with AsyncSessionLocal() as session:
            symbols = await holding_service.list_active_symbols(session)

        if not symbols:
            await asyncio.sleep(settings.market_data_poll_interval_ms / 1000)
            continue

        for symbol in symbols:
            try:
                market_price = await market_data_service.fetch_latest_price(symbol)
                await market_data_service.publish_price_tick(redis_client, market_price)
            except Exception:
                logger.exception("Failed to refresh market data for %s", symbol)

        await asyncio.sleep(settings.market_data_poll_interval_ms / 1000)


if __name__ == "__main__":
    asyncio.run(run_market_data_poller())
