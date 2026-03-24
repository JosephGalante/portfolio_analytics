from __future__ import annotations

from typing import Any
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer


def serialize_decimal(value: Decimal) -> str:
    if value.is_zero():
        return "0"
    return format(value.normalize(), "f")


class AppSchema(BaseModel):
    model_config = ConfigDict()

    @field_serializer("*", when_used="json", check_fields=False)
    def serialize_decimals(self, value: Any) -> Any:
        if isinstance(value, Decimal):
            return serialize_decimal(value)
        return value


class ORMAppSchema(AppSchema):
    model_config = ConfigDict(from_attributes=True)
