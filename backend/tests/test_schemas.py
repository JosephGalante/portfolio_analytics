from __future__ import annotations

from decimal import Decimal

from app.schemas.base import AppSchema


class DecimalPayload(AppSchema):
    whole: Decimal
    abbreviated: Decimal
    precise_zero: Decimal


def test_app_schema_serializes_decimals_as_abbreviated_strings() -> None:
    payload = DecimalPayload(
        whole=Decimal("200.0000"),
        abbreviated=Decimal("300.5000"),
        precise_zero=Decimal("0.0000"),
    )

    assert payload.model_dump(mode="json") == {
        "whole": "200",
        "abbreviated": "300.5",
        "precise_zero": "0",
    }
