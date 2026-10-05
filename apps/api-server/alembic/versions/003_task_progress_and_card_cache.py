"""task progress columns and the Postgres card cache (replaces Redis)

Revision ID: 003
Revises: 002
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("progress", sa.String(), nullable=True))
    op.add_column("tasks", sa.Column("message", sa.Text(), nullable=True))
    op.create_table(
        "card_cache",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_card_cache_expires_at", "card_cache", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_card_cache_expires_at", table_name="card_cache")
    op.drop_table("card_cache")
    op.drop_column("tasks", "message")
    op.drop_column("tasks", "progress")
