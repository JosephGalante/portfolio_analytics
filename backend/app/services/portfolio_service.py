from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.portfolio import Portfolio
from app.models.user import User


async def create_portfolio(session: AsyncSession, user: User, name: str) -> Portfolio:
    portfolio = Portfolio(user_id=user.id, name=name.strip())
    session.add(portfolio)
    await session.commit()
    await session.refresh(portfolio)
    return portfolio


async def list_portfolios(session: AsyncSession, user_id: UUID) -> list[Portfolio]:
    result = await session.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
        .order_by(Portfolio.created_at.desc())
    )
    return list(result.scalars().all())


async def get_portfolio_for_user(
    session: AsyncSession, portfolio_id: UUID, user_id: UUID
) -> Portfolio:
    result = await session.execute(
        select(Portfolio)
        .options(selectinload(Portfolio.holdings))
        .where(Portfolio.id == portfolio_id, Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")
    return portfolio
