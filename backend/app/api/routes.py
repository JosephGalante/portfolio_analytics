from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.holdings import router as holdings_router
from app.api.meta import router as meta_router
from app.api.portfolios import router as portfolios_router
from app.api.snapshots import router as snapshots_router
from app.api.valuations import router as valuations_router

router = APIRouter()
router.include_router(meta_router)
router.include_router(health_router)
router.include_router(portfolios_router)
router.include_router(holdings_router)
router.include_router(valuations_router)
router.include_router(snapshots_router)
