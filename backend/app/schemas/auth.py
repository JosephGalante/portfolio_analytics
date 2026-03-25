from __future__ import annotations

from uuid import UUID

from app.schemas.base import ORMAppSchema


class UserRead(ORMAppSchema):
    id: UUID
    email: str
    name: str
