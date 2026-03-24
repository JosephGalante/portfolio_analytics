from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PriceEvent(Base):
    __tablename__ = "price_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    event_ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
