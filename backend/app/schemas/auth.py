from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.schemas.base import AppSchema, ORMAppSchema


class UserRead(ORMAppSchema):
    id: UUID
    email: str
    name: str
    is_demo: bool


class GuestSessionRead(AppSchema):
    access_token: str
    token_type: str
    expires_at: datetime
    user: UserRead
