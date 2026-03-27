import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.redis import redis_client
from app.db.session import AsyncSessionLocal
from app.services import demo_service
from app.websocket.manager import connection_manager
from app.websocket.subscriber import portfolio_updates_listener
from app.workers.market_data_poller import run_market_data_poller
from app.workers.valuation_worker import run_worker

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    background_tasks = [
        asyncio.create_task(
            portfolio_updates_listener(redis_client=redis_client, manager=connection_manager)
        )
    ]

    if settings.run_embedded_workers:
        background_tasks.append(asyncio.create_task(run_worker()))
        background_tasks.append(asyncio.create_task(run_market_data_poller()))

    try:
        if settings.is_guest_demo_enabled:
            async with AsyncSessionLocal() as session:
                await demo_service.ensure_guest_demo_state(
                    session,
                    redis_client,
                    reset=settings.guest_demo_reset_on_start,
                )
        yield
    finally:
        for task in background_tasks:
            task.cancel()
        for task in background_tasks:
            with suppress(asyncio.CancelledError):
                await task
        await redis_client.aclose()


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
