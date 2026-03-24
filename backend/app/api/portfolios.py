from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.portfolio import PortfolioCreate, PortfolioDetailRead, PortfolioRead
from app.services import portfolio_service

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


@router.post("", response_model=PortfolioRead, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    payload: PortfolioCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PortfolioRead:
    portfolio = await portfolio_service.create_portfolio(session, current_user, payload.name)
    return PortfolioRead.model_validate(portfolio)


@router.get("", response_model=list[PortfolioRead])
async def list_portfolios(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PortfolioRead]:
    portfolios = await portfolio_service.list_portfolios(session, current_user.id)
    return [PortfolioRead.model_validate(portfolio) for portfolio in portfolios]


@router.get("/{portfolio_id}", response_model=PortfolioDetailRead)
async def get_portfolio(
    portfolio_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PortfolioDetailRead:
    portfolio = await portfolio_service.get_portfolio_for_user(session, portfolio_id, current_user.id)
    return PortfolioDetailRead(
        id=portfolio.id,
        name=portfolio.name,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
        holdings_count=len(portfolio.holdings),
    )
