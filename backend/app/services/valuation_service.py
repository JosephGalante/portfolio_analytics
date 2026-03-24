from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.holding import Holding
from app.schemas.valuation import PortfolioValuationRead

MONEY_PRECISION = Decimal("0.0001")


def _portfolio_valuation_key(portfolio_id: UUID) -> str:
    return f"portfolio:{portfolio_id}:valuation"


def _symbol_last_price_key(symbol: str) -> str:
    return f"symbol:{symbol.upper()}:last_price"


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)


async def get_cached_valuation(
    redis_client: Redis,
    portfolio_id: UUID,
) -> PortfolioValuationRead | None:
    cached = await redis_client.get(_portfolio_valuation_key(portfolio_id))
    if cached is None:
        return None
    return PortfolioValuationRead.model_validate_json(cached)


async def cache_valuation(redis_client: Redis, valuation: PortfolioValuationRead) -> None:
    await redis_client.set(_portfolio_valuation_key(valuation.portfolio_id), valuation.model_dump_json())


async def build_portfolio_valuation(
    session: AsyncSession,
    redis_client: Redis,
    portfolio_id: UUID,
) -> PortfolioValuationRead:
    result = await session.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id).order_by(Holding.symbol.asc())
    )
    holdings = list(result.scalars().all())

    price_keys = [_symbol_last_price_key(holding.symbol) for holding in holdings]
    latest_prices = await redis_client.mget(price_keys) if price_keys else []

    total_market_value = Decimal("0")
    total_cost_basis = Decimal("0")
    priced_holdings_count = 0

    for holding, latest_price in zip(holdings, latest_prices, strict=True):
        total_cost_basis += holding.quantity * holding.average_cost_basis
        if latest_price is not None:
            total_market_value += holding.quantity * Decimal(latest_price)
            priced_holdings_count += 1

    total_market_value = _quantize_money(total_market_value)
    total_cost_basis = _quantize_money(total_cost_basis)
    unrealized_pnl = _quantize_money(total_market_value - total_cost_basis)

    return PortfolioValuationRead(
        portfolio_id=portfolio_id,
        total_market_value=total_market_value,
        total_cost_basis=total_cost_basis,
        unrealized_pnl=unrealized_pnl,
        holdings_count=len(holdings),
        priced_holdings_count=priced_holdings_count,
        as_of=datetime.now(UTC),
    )


async def warm_portfolio_cache(
    session: AsyncSession,
    redis_client: Redis,
    portfolio_id: UUID,
) -> PortfolioValuationRead:
    valuation = await build_portfolio_valuation(session, redis_client, portfolio_id)
    await cache_valuation(redis_client, valuation)
    return valuation
