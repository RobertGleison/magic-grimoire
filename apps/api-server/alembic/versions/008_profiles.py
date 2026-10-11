"""profiles: the public byline (name + avatar) on community decks

Revision ID: 008_profiles
Revises: 007_deck_tags
Create Date: 2026-10-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_profiles"
down_revision: Union[str, None] = "007_deck_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("user_id", sa.String(), primary_key=True),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    # Profiles are otherwise written on save, so decks already in the feed would
    # show no author until their owner saved again. On Supabase, seed one row per
    # deck owner from auth.users, with the same rules as
    # app.auth.dependencies.public_profile_from_claims (handle first, never the
    # email, 60-char name, https-only avatar). Elsewhere (local, tests) there is
    # no auth schema and this is a no-op.
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('auth.users') IS NOT NULL THEN
            INSERT INTO profiles (user_id, display_name, avatar_url)
            SELECT u.id::text,
                   left(coalesce(
                     nullif(btrim(u.raw_user_meta_data->>'user_name'), ''),
                     nullif(btrim(u.raw_user_meta_data->>'preferred_username'), ''),
                     nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                     nullif(btrim(u.raw_user_meta_data->>'name'), '')
                   ), 60),
                   CASE WHEN u.raw_user_meta_data->>'avatar_url' LIKE 'https://%'
                         AND length(u.raw_user_meta_data->>'avatar_url') <= 2048
                        THEN u.raw_user_meta_data->>'avatar_url' END
            FROM auth.users u
            WHERE u.id::text IN (SELECT DISTINCT user_id FROM decks WHERE user_id IS NOT NULL)
            ON CONFLICT (user_id) DO NOTHING;
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.drop_table("profiles")
