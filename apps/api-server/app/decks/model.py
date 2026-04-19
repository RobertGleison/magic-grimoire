import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
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

    format: Mapped[str] = mapped_column(
        String,
        server_default="standard",
        default="standard",
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
        default=0,
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String,
        server_default="pending",
        default="pending",
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
