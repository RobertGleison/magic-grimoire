"""deck versions: saved_at, lineage_id, version_no

Revision ID: 002
Revises: 001
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("decks", sa.Column("saved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("decks", sa.Column("version_no", sa.Integer(), nullable=True))
    # Added nullable, backfilled, then made NOT NULL — an existing table cannot
    # take a NOT NULL column with no server default in one step.
    op.add_column("decks", sa.Column("lineage_id", postgresql.UUID(as_uuid=True), nullable=True))

    # Every deck that already exists is one somebody can see in their library
    # today. Treat each as its own lineage, saved at creation, version 1, so
    # nothing disappears when GET /decks starts filtering on saved_at.
    op.execute(
        """
        UPDATE decks
           SET lineage_id = id,
               saved_at   = created_at,
               version_no = 1
        """
    )

    op.alter_column("decks", "lineage_id", nullable=False)

    op.create_index("ix_decks_lineage_id", "decks", ["lineage_id"])
    op.create_index("ix_decks_user_saved", "decks", ["user_id", "saved_at"])
    op.create_unique_constraint(
        "uq_decks_lineage_version", "decks", ["lineage_id", "version_no"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_decks_lineage_version", "decks", type_="unique")
    op.drop_index("ix_decks_user_saved", table_name="decks")
    op.drop_index("ix_decks_lineage_id", table_name="decks")
    op.drop_column("decks", "lineage_id")
    op.drop_column("decks", "version_no")
    op.drop_column("decks", "saved_at")
