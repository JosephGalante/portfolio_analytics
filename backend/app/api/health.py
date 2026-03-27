from fastapi import APIRouter, Depends, Response, status
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import get_settings
from app.db.redis import get_redis

settings = get_settings()
router = APIRouter()


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}


@router.get("/ready")
async def readiness(
    response: Response,
    session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> dict[str, object]:
    checks: dict[str, str] = {
        "guest_demo": "enabled" if settings.is_guest_demo_enabled else "disabled",
        "stytch": "configured"
        if settings.is_stytch_configured
        else "optional" if settings.is_guest_demo_enabled else "missing",
        "market_data": "configured" if settings.is_market_data_configured else "missing",
        "embedded_workers": "enabled" if settings.run_embedded_workers else "disabled",
    }
    errors: dict[str, str] = {}
    is_ready = True

    try:
        await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = "error"
        errors["database"] = str(exc)
        is_ready = False

    try:
        await redis_client.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = "error"
        errors["redis"] = str(exc)
        is_ready = False

    if not settings.is_stytch_configured and not settings.is_guest_demo_enabled:
        errors["stytch"] = "STYTCH_PROJECT_ID and STYTCH_SECRET must both be set."
        is_ready = False

    if not settings.is_market_data_configured:
        errors["market_data"] = "FINNHUB_API_KEY must be set."
        is_ready = False

    response.status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    payload: dict[str, object] = {
        "status": "ready" if is_ready else "not_ready",
        "environment": settings.app_env,
        "checks": checks,
    }
    if errors:
        payload["errors"] = errors
    return payload
