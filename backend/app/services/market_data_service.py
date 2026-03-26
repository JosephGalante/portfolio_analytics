from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import HTTPException, status
from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.constants import PRICE_TICK_STREAM, symbol_last_price_key

PRICE_PRECISION = Decimal("0.0001")
SOURCE_FINNHUB = "finnhub"


@dataclass(slots=True)
class MarketPrice:
    event_ts: datetime
    price: Decimal
    source: str
    symbol: str


def _service_error(
    detail: str,
    *,
    status_code: int = status.HTTP_503_SERVICE_UNAVAILABLE,
) -> HTTPException:
    return HTTPException(status_code=status_code, detail=detail)


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


async def fetch_latest_price(symbol: str) -> MarketPrice:
    settings = get_settings()
    api_key = settings.finnhub_api_key.strip()
    if not api_key:
        raise _service_error("Finnhub is not configured.")

    normalized_symbol = _normalize_symbol(symbol)
    try:
        async with httpx.AsyncClient(
            timeout=settings.market_data_request_timeout_seconds
        ) as client:
            response = await client.get(
                f"{settings.finnhub_api_url.rstrip('/')}/quote",
                params={
                    "symbol": normalized_symbol,
                    "token": api_key,
                },
            )
    except httpx.HTTPError as error:
        raise _service_error("Failed to reach Finnhub.") from error

    try:
        payload = response.json()
    except ValueError as error:
        raise _service_error("Finnhub returned an invalid response.") from error

    if not isinstance(payload, dict):
        raise _service_error("Finnhub returned an invalid response.")

    if response.status_code != status.HTTP_200_OK:
        error_message = payload.get("error")
        if isinstance(error_message, str) and error_message.strip():
            raise _service_error(error_message.strip(), status_code=response.status_code)
        raise _service_error(
            "Finnhub market-data request failed.",
            status_code=response.status_code,
        )

    error_message = payload.get("error")
    if isinstance(error_message, str) and error_message.strip():
        raise _service_error(error_message.strip(), status_code=status.HTTP_400_BAD_REQUEST)

    raw_price = payload.get("c")
    if isinstance(raw_price, (float, int, str)):
        try:
            price = Decimal(str(raw_price)).quantize(PRICE_PRECISION)
        except InvalidOperation as error:
            raise _service_error("Finnhub returned an invalid price.") from error
        if price <= 0:
            raise _service_error(
                f"{normalized_symbol} is unavailable from the configured Finnhub feed.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        raw_timestamp = payload.get("t")
        event_ts = datetime.now(UTC)
        if isinstance(raw_timestamp, (int, float)) and raw_timestamp > 0:
            event_ts = datetime.fromtimestamp(raw_timestamp, UTC)

        return MarketPrice(
            symbol=normalized_symbol,
            price=price,
            event_ts=event_ts,
            source=SOURCE_FINNHUB,
        )

    raise _service_error("Unable to fetch market data.")


async def publish_price_tick(
    redis_client: Redis,
    market_price: MarketPrice,
    *,
    force: bool = False,
) -> bool:
    current_price = await redis_client.get(symbol_last_price_key(market_price.symbol))
    if current_price is not None and not force:
        try:
            if Decimal(current_price) == market_price.price:
                return False
        except InvalidOperation:
            pass

    await redis_client.xadd(
        PRICE_TICK_STREAM,
        {
            "symbol": market_price.symbol,
            "price": str(market_price.price),
            "event_ts": market_price.event_ts.isoformat(),
            "source": market_price.source,
        },
    )
    return True
