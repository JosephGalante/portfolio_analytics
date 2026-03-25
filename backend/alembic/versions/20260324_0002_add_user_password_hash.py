"""Add password hash to users.

Revision ID: 20260324_0002
Revises: 20260324_0001
Create Date: 2026-03-24 00:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260324_0002"
down_revision: str | None = "20260324_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
