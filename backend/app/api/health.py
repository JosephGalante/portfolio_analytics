from fastapi import APIRouter

from app.core.config import get_settings

settings = get_settings()
router = APIRouter()


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}
