from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.schemas.base import ORMAppSchema


class PortfolioSnapshotRead(ORMAppSchema):
    id: UUID
    portfolio_id: UUID
    total_market_value: Decimal
    total_cost_basis: Decimal
    unrealized_pnl: Decimal
    captured_at: datetime
