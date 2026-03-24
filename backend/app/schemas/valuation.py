from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.schemas.base import ORMAppSchema


class PortfolioValuationRead(ORMAppSchema):
    portfolio_id: UUID
    total_market_value: Decimal
    total_cost_basis: Decimal
    unrealized_pnl: Decimal
    holdings_count: int
    priced_holdings_count: int
    as_of: datetime
