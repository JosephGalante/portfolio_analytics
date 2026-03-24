from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    total_market_value: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    total_cost_basis: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    portfolio: Mapped["Portfolio"] = relationship(back_populates="snapshots")
