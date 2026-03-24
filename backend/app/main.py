import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.redis import redis_client
from app.db.seed import ensure_seeded_user
from app.db.session import AsyncSessionLocal
from app.websocket.manager import connection_manager
from app.websocket.subscriber import portfolio_updates_listener

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with AsyncSessionLocal() as session:
        await ensure_seeded_user(session)

    listener_task = asyncio.create_task(
        portfolio_updates_listener(redis_client=redis_client, manager=connection_manager)
    )
    try:
        yield
    finally:
        listener_task.cancel()
        with suppress(asyncio.CancelledError):
            await listener_task
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
