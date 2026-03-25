from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import ORMAppSchema


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class UserRead(ORMAppSchema):
    id: UUID
    email: str
    name: str
