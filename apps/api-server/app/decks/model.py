import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Deck(Base):
    __tablename__ = "decks"

    # A deck row is one of two things. `saved_at IS NULL` is a mutable working
    # draft: the forge writes it and every refine overwrites it, and it is
    # invisible to the library. `saved_at IS NOT NULL` is an immutable snapshot
    # taken by POST /decks/{id}/save — the only thing GET /decks returns.
    __table_args__ = (
        Index("ix_decks_user_saved", "user_id", "saved_at"),
        # Version numbers are computed from a read, so two concurrent saves of
        # the same draft could pick the same number. Drafts carry NULL, and
        # Postgres allows many NULLs in a unique index, so this constrains
        # snapshots only.
        UniqueConstraint("lineage_id", "version_no", name="uq_decks_lineage_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    title: Mapped[str | None] = mapped_column(
        String,
        nullable=True
    )

    prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    user_id: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        index=True,
    )

    format: Mapped[str] = mapped_column(
        String,
        server_default="standard",
        nullable=False
    )

    colors: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True
    )

    cards: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True
    )

    card_count: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String,
        server_default="pending",
        nullable=False
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    failed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    saved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Groups a draft with every snapshot ever taken from it, so version numbers
    # read as "v3 of this deck" rather than being global. An opaque group key:
    # nothing depends on its value, only on two rows sharing it, so a new deck
    # taking a fresh one from the default is correct — it starts its own lineage.
    #
    # What is NOT optional is carrying the source's value forward when copying a
    # deck (saving a snapshot, forking a draft off one). Miss it there and the
    # copy silently starts a new lineage, restarting version numbers at 1.
    lineage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        default=uuid.uuid4,
        nullable=False,
        index=True,
    )

    version_no: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
