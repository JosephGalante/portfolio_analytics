from fastapi import APIRouter

from app.core.config import get_settings

settings = get_settings()
router = APIRouter()


@router.get("/")
async def service_metadata() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
    }
