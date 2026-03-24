from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import ORMAppSchema


class HoldingUpsert(BaseModel):
    symbol: str = Field(min_length=1, max_length=16)
    quantity: Decimal = Field(gt=Decimal("0"))
    average_cost_basis: Decimal = Field(gt=Decimal("0"))

    @field_validator("symbol")
    @classmethod
    def normalize_symbol(cls, value: str) -> str:
        return value.strip().upper()


class HoldingRead(ORMAppSchema):
    id: UUID
    portfolio_id: UUID
    symbol: str
    quantity: Decimal
    average_cost_basis: Decimal
    created_at: datetime
    updated_at: datetime
