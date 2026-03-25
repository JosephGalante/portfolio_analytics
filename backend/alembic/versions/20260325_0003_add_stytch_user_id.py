"""Add Stytch user id to users.

Revision ID: 20260325_0003
Revises: 20260324_0002
Create Date: 2026-03-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260325_0003"
down_revision: str | None = "20260324_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("stytch_user_id", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_users_stytch_user_id", "users", ["stytch_user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_users_stytch_user_id", "users", type_="unique")
    op.drop_column("users", "stytch_user_id")
