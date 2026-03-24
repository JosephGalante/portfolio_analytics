from __future__ import annotations

import asyncio
from contextlib import suppress
from uuid import UUID

from redis.asyncio import Redis

from app.core.constants import PORTFOLIO_UPDATES_CHANNEL_PREFIX
from app.websocket.manager import ConnectionManager


async def portfolio_updates_listener(redis_client: Redis, manager: ConnectionManager) -> None:
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe(f"{PORTFOLIO_UPDATES_CHANNEL_PREFIX}:*")

    try:
        async for message in pubsub.listen():
            if message["type"] not in {"message", "pmessage"}:
                continue

            channel = message["channel"]
            payload = message["data"]
            if isinstance(channel, bytes):
                channel = channel.decode()
            if isinstance(payload, bytes):
                payload = payload.decode()

            _, portfolio_id = channel.split(":", maxsplit=1)
            await manager.broadcast_json(UUID(portfolio_id), payload)
    except asyncio.CancelledError:
        raise
    finally:
        with suppress(Exception):
            await pubsub.aclose()
