from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.snapshot import PortfolioSnapshotRead
from app.services import portfolio_service, snapshot_service

router = APIRouter(prefix="/portfolios/{portfolio_id}/snapshots", tags=["snapshots"])


@router.get("", response_model=list[PortfolioSnapshotRead])
async def get_portfolio_snapshots(
    portfolio_id: UUID,
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PortfolioSnapshotRead]:
    portfolio = await portfolio_service.get_portfolio_for_user(
        session, portfolio_id, current_user.id
    )
    snapshots = await snapshot_service.list_snapshots(
        session,
        portfolio.id,
        limit=limit,
        offset=offset,
    )
    return [PortfolioSnapshotRead.model_validate(snapshot) for snapshot in snapshots]
