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


class DeckFormat(StrEnum):
    STANDARD  = "standard"
    MODERN    = "modern"
    PIONEER   = "pioneer"
    LEGACY    = "legacy"
    COMMANDER = "commander"


class TaskType(StrEnum):
    GENERATE_DECK = "generate_deck"
