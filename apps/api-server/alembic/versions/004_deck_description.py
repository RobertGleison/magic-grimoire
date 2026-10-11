"""deck description: a short LLM-written summary of the deck idea

Revision ID: 004_deck_description
Revises: 003
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_deck_description"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable with no backfill: decks forged before this have no description,
    # and the UI hides the block for them.
    op.add_column("decks", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("decks", "description")
