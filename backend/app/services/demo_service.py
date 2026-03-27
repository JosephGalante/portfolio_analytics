from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.constants import portfolio_valuation_key, symbol_last_price_key
from app.models.holding import Holding
from app.models.portfolio import Portfolio
from app.models.user import User
from app.services import valuation_service

_DEMO_PORTFOLIOS = [
    {
        "holdings": [
            {"average_cost_basis": "172.50", "quantity": "14", "symbol": "AAPL"},
            {"average_cost_basis": "398.25", "quantity": "9", "symbol": "MSFT"},
            {"average_cost_basis": "865.00", "quantity": "4", "symbol": "NVDA"},
        ],
        "name": "Guest Demo • Growth",
    },
    {
        "holdings": [
            {"average_cost_basis": "145.10", "quantity": "11", "symbol": "GOOGL"},
            {"average_cost_basis": "176.40", "quantity": "12", "symbol": "AMZN"},
            {"average_cost_basis": "181.20", "quantity": "8", "symbol": "AAPL"},
        ],
        "name": "Guest Demo • Core",
    },
]


async def _clear_demo_cache(redis_client: Redis, portfolio_ids: list[UUID]) -> None:
    if not portfolio_ids:
        return

    await redis_client.delete(*(portfolio_valuation_key(portfolio_id) for portfolio_id in portfolio_ids))


async def _get_demo_user(session: AsyncSession) -> User | None:
    settings = get_settings()
    result = await session.execute(select(User).where(User.email == settings.guest_demo_user_email))
    return result.scalar_one_or_none()


async def _ensure_demo_user(session: AsyncSession) -> User:
    settings = get_settings()
    user = await _get_demo_user(session)
    if user is None:
        user = User(
            email=settings.guest_demo_user_email,
            name=settings.guest_demo_user_name,
            password_hash=None,
            stytch_user_id=None,
            is_demo=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user

    if not user.is_demo:
        raise RuntimeError(
            f"User {settings.guest_demo_user_email} already exists but is not marked as demo."
        )

    needs_refresh = False
    if user.name != settings.guest_demo_user_name:
        user.name = settings.guest_demo_user_name
        needs_refresh = True

    if needs_refresh:
        await session.commit()
        await session.refresh(user)

    return user


async def _seed_demo_portfolios(session: AsyncSession, user_id: UUID) -> list[Portfolio]:
    portfolios: list[Portfolio] = []
    for portfolio_seed in _DEMO_PORTFOLIOS:
        portfolio = Portfolio(user_id=user_id, name=portfolio_seed["name"])
        session.add(portfolio)
        await session.flush()
        portfolios.append(portfolio)

        for holding_seed in portfolio_seed["holdings"]:
            session.add(
                Holding(
                    portfolio_id=portfolio.id,
                    symbol=holding_seed["symbol"],
                    quantity=Decimal(holding_seed["quantity"]),
                    average_cost_basis=Decimal(holding_seed["average_cost_basis"]),
                )
            )

    await session.commit()
    for portfolio in portfolios:
        await session.refresh(portfolio)
    return portfolios


async def _load_demo_portfolios(session: AsyncSession, user_id: UUID) -> list[Portfolio]:
    result = await session.execute(
        select(Portfolio).where(Portfolio.user_id == user_id).order_by(Portfolio.created_at.asc())
    )
    return list(result.scalars().all())


async def _warm_demo_state(
    session: AsyncSession,
    redis_client: Redis,
    portfolios: list[Portfolio],
    *,
    create_initial_snapshots: bool,
) -> None:
    settings = get_settings()
    demo_symbols = {
        holding["symbol"]
        for portfolio_seed in _DEMO_PORTFOLIOS
        for holding in portfolio_seed["holdings"]
    }
    for symbol in demo_symbols:
        initial_price = settings.initial_prices.get(symbol)
        if initial_price is not None:
            await redis_client.set(symbol_last_price_key(symbol), initial_price)

    valuations = []
    for portfolio in portfolios:
        valuation = await valuation_service.build_portfolio_valuation(
            session,
            redis_client,
            portfolio.id,
        )
        valuations.append(valuation)
        if create_initial_snapshots:
            session.add(valuation_service.snapshot_from_valuation(valuation))

    if create_initial_snapshots:
        await session.commit()

    for valuation in valuations:
        await valuation_service.cache_valuation(redis_client, valuation)


async def ensure_guest_demo_state(
    session: AsyncSession,
    redis_client: Redis | None = None,
    *,
    reset: bool = False,
) -> User:
    settings = get_settings()
    if not settings.is_guest_demo_enabled:
        raise RuntimeError("Guest demo mode is disabled.")

    user = await _ensure_demo_user(session)
    portfolios = await _load_demo_portfolios(session, user.id)

    if reset and portfolios:
        portfolio_ids = [portfolio.id for portfolio in portfolios]
        await session.execute(delete(Portfolio).where(Portfolio.user_id == user.id))
        await session.commit()
        if redis_client is not None:
            await _clear_demo_cache(redis_client, portfolio_ids)
        portfolios = []

    created_seed_data = False
    if not portfolios:
        portfolios = await _seed_demo_portfolios(session, user.id)
        created_seed_data = True

    if redis_client is not None and portfolios:
        await _warm_demo_state(
            session,
            redis_client,
            portfolios,
            create_initial_snapshots=created_seed_data,
        )

    return user
