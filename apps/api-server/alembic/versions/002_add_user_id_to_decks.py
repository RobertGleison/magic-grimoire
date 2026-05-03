"""add user_id to decks

Revision ID: 002
Revises: 001
Create Date: 2026-05-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('decks', sa.Column('user_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_decks_user_id'), 'decks', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_decks_user_id'), table_name='decks')
    op.drop_column('decks', 'user_id')
