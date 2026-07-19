from enum import StrEnum


class DeckStatus(StrEnum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"


class TaskStatus(StrEnum):
    QUEUED     = "queued"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"


class TaskProgress(StrEnum):
    """Statuses published over the task SSE channel — a superset of the terminal
    TaskStatus values, adding the mid-pipeline progress steps the frontend renders."""

    PROCESSING      = "processing"
    SEARCHING_CARDS = "searching_cards"
    COMPOSING_DECK  = "composing_deck"
    ENRICHING       = "enriching"
    COMPLETED       = "completed"
    FAILED          = "failed"


class DeckFormat(StrEnum):
    STANDARD  = "standard"
    MODERN    = "modern"
    PIONEER   = "pioneer"
    LEGACY    = "legacy"
    COMMANDER = "commander"


class TaskType(StrEnum):
    GENERATE_DECK = "generate_deck"
