from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.redis import get_redis
from app.models.user import User
from app.schemas.valuation import PortfolioValuationRead
from app.services import portfolio_service, valuation_service

router = APIRouter(prefix="/portfolios/{portfolio_id}/valuation", tags=["valuations"])


@router.get("", response_model=PortfolioValuationRead)
async def get_portfolio_valuation(
    portfolio_id: UUID,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
) -> PortfolioValuationRead:
    portfolio = await portfolio_service.get_portfolio_for_user(
        session, portfolio_id, current_user.id
    )
    cached = await valuation_service.get_cached_valuation(redis_client, portfolio.id)
    if cached is not None:
        return cached
    return await valuation_service.warm_portfolio_cache(session, redis_client, portfolio.id)
