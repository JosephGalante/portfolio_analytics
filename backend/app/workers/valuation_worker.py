from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import PRICE_TICK_STREAM, symbol_last_price_key
from app.db.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.models.price_event import PriceEvent
from app.services import portfolio_service, valuation_service


def _parse_event_ts(raw_value: str | None) -> datetime:
    if raw_value is None:
        return datetime.now(UTC)
    return datetime.fromisoformat(raw_value)


async def _apply_tick(session: AsyncSession, tick: dict[str, str]) -> None:
    symbol = tick["symbol"].upper()
    price = Decimal(tick["price"])
    event_ts = _parse_event_ts(tick.get("event_ts"))
    source = tick.get("source", "simulator")

    await redis_client.set(symbol_last_price_key(symbol), str(price))

    session.add(
        PriceEvent(
            symbol=symbol,
            price=price,
            event_ts=event_ts,
            source=source,
        )
    )

    portfolio_ids = await portfolio_service.list_portfolio_ids_for_symbol(session, symbol)
    valuations = []
    for portfolio_id in portfolio_ids:
        valuation = await valuation_service.build_portfolio_valuation(
            session,
            redis_client,
            portfolio_id,
            as_of=event_ts,
        )
        session.add(valuation_service.snapshot_from_valuation(valuation))
        valuations.append(valuation)

    # Commit the database writes before pushing cache/pubsub side effects.
    await session.commit()

    for valuation in valuations:
        await valuation_service.cache_valuation(redis_client, valuation)
        await valuation_service.publish_valuation_update(redis_client, valuation)


async def run_worker() -> None:
    # MVP behavior: start at the current stream tail to avoid duplicating
    # historical price_events and snapshots after a worker restart.
    last_stream_id = "$"

    while True:
        messages = await redis_client.xread(
            {PRICE_TICK_STREAM: last_stream_id}, block=5000, count=10
        )
        if not messages:
            continue

        for _, stream_messages in messages:
            for stream_id, payload in stream_messages:
                normalized_payload = {
                    key.decode() if isinstance(key, bytes) else key: value.decode()
                    if isinstance(value, bytes)
                    else value
                    for key, value in payload.items()
                }
                async with AsyncSessionLocal() as session:
                    await _apply_tick(session, normalized_payload)
                last_stream_id = stream_id.decode() if isinstance(stream_id, bytes) else stream_id


if __name__ == "__main__":
    asyncio.run(run_worker())
