from fastapi import FastAPI

from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.app_env}
