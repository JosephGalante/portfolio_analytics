from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.holding import Holding
from app.models.portfolio import Portfolio
from app.schemas.holding import HoldingUpsert


async def upsert_holding(
    session: AsyncSession, portfolio: Portfolio, payload: HoldingUpsert
) -> Holding:
    result = await session.execute(
        select(Holding).where(
            Holding.portfolio_id == portfolio.id,
            Holding.symbol == payload.symbol,
        )
    )
    holding = result.scalar_one_or_none()
    if holding is None:
        holding = Holding(
            portfolio_id=portfolio.id,
            symbol=payload.symbol,
            quantity=payload.quantity,
            average_cost_basis=payload.average_cost_basis,
        )
        session.add(holding)
    else:
        holding.quantity = payload.quantity
        holding.average_cost_basis = payload.average_cost_basis

    await session.commit()
    await session.refresh(holding)
    return holding


async def list_holdings(session: AsyncSession, portfolio_id: UUID) -> list[Holding]:
    result = await session.execute(
        select(Holding)
        .where(Holding.portfolio_id == portfolio_id)
        .order_by(Holding.symbol.asc(), Holding.created_at.asc())
    )
    return list(result.scalars().all())
