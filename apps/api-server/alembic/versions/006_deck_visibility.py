"""deck visibility: is_public (new decks public, existing decks private)

Revision ID: 006_deck_visibility
Revises: 003
Create Date: 2026-10-11 00:00:00.000000

NOTE: written in parallel with 004_deck_description and 005_task_cancel. If
those merge first, re-point `down_revision` at the latest head before merging
this one, or Alembic ends up with two heads.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_deck_visibility"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing decks were created when every deck was private. Backfill them as
    # private so nothing is published without its owner opting in...
    op.add_column(
        "decks",
        sa.Column("is_public", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    # ...then flip the default so every deck created from now on is public.
    op.alter_column("decks", "is_public", server_default=sa.text("true"))


def downgrade() -> None:
    op.drop_column("decks", "is_public")
