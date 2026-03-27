from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.models.user import User
from app.schemas.auth import GuestSessionRead, UserRead
from app.services import auth_service, demo_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.post(
    "/guest-session",
    response_model=GuestSessionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_guest_session(
    session: AsyncSession = Depends(get_db),
) -> GuestSessionRead:
    if not settings.is_guest_demo_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest demo is disabled.")

    user = await demo_service.ensure_guest_demo_state(session)
    guest_session = auth_service.issue_guest_session(user)
    return GuestSessionRead(
        access_token=guest_session.token,
        token_type="bearer",
        expires_at=guest_session.expires_at,
        user=UserRead.model_validate(user),
    )
