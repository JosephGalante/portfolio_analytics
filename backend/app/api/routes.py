from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.meta import router as meta_router

router = APIRouter()
router.include_router(meta_router)
router.include_router(health_router)
