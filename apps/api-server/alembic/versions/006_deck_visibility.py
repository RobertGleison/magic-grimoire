"""deck visibility: is_public (new decks public, existing decks private)

Revision ID: 006_deck_visibility
Revises: 004_deck_description
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_deck_visibility"
down_revision: Union[str, None] = "004_deck_description"
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
