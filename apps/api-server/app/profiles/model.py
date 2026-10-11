from datetime import datetime

from sqlalchemy import DateTime, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Profile(Base):
    """What the community sees of a user: the byline on their public decks.

    Supabase owns accounts (`auth.users`); this is a public copy of the two
    fields we show, refreshed from the token's `user_metadata` whenever the user
    saves a deck. Keyed like `decks.user_id`, which it joins on.
    """

    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )
