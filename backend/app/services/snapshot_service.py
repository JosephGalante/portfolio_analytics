from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.snapshot import PortfolioSnapshot


async def list_snapshots(
    session: AsyncSession,
    portfolio_id: UUID,
    *,
    limit: int,
    offset: int,
) -> list[PortfolioSnapshot]:
    result = await session.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.portfolio_id == portfolio_id)
        .order_by(PortfolioSnapshot.captured_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
