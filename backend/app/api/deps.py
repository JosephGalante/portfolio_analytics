from collections.abc import AsyncIterator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.seed import ensure_seeded_user
from app.db.session import get_db_session
from app.models.user import User


async def get_db(session: AsyncSession = Depends(get_db_session)) -> AsyncIterator[AsyncSession]:
    yield session


async def get_current_user(session: AsyncSession = Depends(get_db)) -> User:
    return await ensure_seeded_user(session)
