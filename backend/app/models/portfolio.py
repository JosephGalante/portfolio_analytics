from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Portfolio(TimestampMixin, Base):
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    user: Mapped["User"] = relationship(back_populates="portfolios")
    holdings: Mapped[list["Holding"]] = relationship(back_populates="portfolio")
    snapshots: Mapped[list["PortfolioSnapshot"]] = relationship(back_populates="portfolio")
