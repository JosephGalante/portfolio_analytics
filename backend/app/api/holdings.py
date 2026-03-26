from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.redis import get_redis
from app.models.user import User
from app.schemas.holding import HoldingRead, HoldingUpsert
from app.services import holding_service, market_data_service, portfolio_service

router = APIRouter(prefix="/portfolios/{portfolio_id}/holdings", tags=["holdings"])


@router.post("", response_model=HoldingRead, status_code=status.HTTP_201_CREATED)
async def upsert_holding(
    portfolio_id: UUID,
    payload: HoldingUpsert,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
) -> HoldingRead:
    portfolio = await portfolio_service.get_portfolio_for_user(
        session, portfolio_id, current_user.id
    )
    latest_price = await market_data_service.fetch_latest_price(payload.symbol)
    holding = await holding_service.upsert_holding(session, portfolio, payload)
    await market_data_service.publish_price_tick(redis_client, latest_price, force=True)
    return HoldingRead.model_validate(holding)


@router.get("", response_model=list[HoldingRead])
async def list_holdings(
    portfolio_id: UUID,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[HoldingRead]:
    portfolio = await portfolio_service.get_portfolio_for_user(
        session, portfolio_id, current_user.id
    )
    holdings = await holding_service.list_holdings(session, portfolio.id)
    return [HoldingRead.model_validate(holding) for holding in holdings]
