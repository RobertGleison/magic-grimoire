"""deck tags + community feed indexes

Revision ID: 007_deck_tags
Revises: 006_deck_visibility
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007_deck_tags"
down_revision: Union[str, None] = "006_deck_visibility"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Every deck, existing or new, starts with no tags.
    op.add_column(
        "decks",
        sa.Column("tags", postgresql.ARRAY(sa.String()), server_default=sa.text("'{}'"), nullable=False),
    )
    # GET /explore/decks: public saved decks, newest first, keyset on (created_at, id).
    op.create_index(
        "ix_decks_public_feed",
        "decks",
        [sa.text("created_at DESC"), sa.text("id DESC")],
        postgresql_where=sa.text("is_public AND saved_at IS NOT NULL"),
    )
    # `@>` containment filters on tags and colours.
    op.create_index("ix_decks_tags_gin", "decks", ["tags"], postgresql_using="gin")
    op.create_index("ix_decks_colors_gin", "decks", ["colors"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_decks_colors_gin", table_name="decks")
    op.drop_index("ix_decks_tags_gin", table_name="decks")
    op.drop_index("ix_decks_public_feed", table_name="decks")
    op.drop_column("decks", "tags")
