from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user import User


async def ensure_seeded_user(session: AsyncSession) -> User:
    settings = get_settings()
    result = await session.execute(select(User).where(User.email == settings.seeded_user_email))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(email=settings.seeded_user_email, name=settings.seeded_user_name)
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
